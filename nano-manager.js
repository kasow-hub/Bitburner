/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
  
    const config = {
      batchDelay: 200,
      moneyThreshold: 0.75,
      securityThreshold: 3,
      logInterval: 10000,
      debugMode: true,
    };
  
    // Logging System
    function log(message, type = "INFO") {
      if (type === "DEBUG" && !config.debugMode) return;
      const timestamp = new Date().toISOString();
      ns.print(`[${timestamp}] [${type}] ${message}`);
    }
  
    // Scan all servers in the network
    function getAllServers() {
      const servers = new Set(["home"]);
      const queue = ["home"];
      while (queue.length > 0) {
        const server = queue.shift();
        for (const neighbor of ns.scan(server)) {
          if (!servers.has(neighbor)) {
            servers.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      return Array.from(servers);
    }
  
    // Calculate profitability of a target
    function calculateProfitability(target) {
      const hackingLevel = ns.getHackingLevel();
      const requiredLevel = ns.getServerRequiredHackingLevel(target);
      const maxMoney = ns.getServerMaxMoney(target);
      const minSecurity = ns.getServerMinSecurityLevel(target);
      const hackTime = ns.getHackTime(target);
      const levelFactor = Math.log2(Math.abs(requiredLevel + 2 - hackingLevel));
  
      return (maxMoney / (minSecurity * levelFactor)) / hackTime;
    }
  
    // Get eligible targets and available servers
    function getEligibleTargetsAndServers() {
      const allServers = getAllServers();
      const hackingLevel = ns.getHackingLevel();
      const targets = [];
      const availableServers = [];
  
      for (const server of allServers) {
        if (ns.hasRootAccess(server) && ns.getServerRequiredHackingLevel(server) <= hackingLevel) {
          if (ns.getServerMaxMoney(server) > 0 && !server.startsWith("home") && !ns.getPurchasedServers().includes(server)) {
            targets.push(server);
          }
          if (ns.getServerMaxRam(server) > 0) {
            availableServers.push(server);
          }
        }
      }
  
      targets.sort((a, b) => calculateProfitability(b) - calculateProfitability(a));
      return { targets, availableServers };
    }
  
    // Calculate required threads for operations
    function calculateThreads(target, operation) {
      const maxMoney = ns.getServerMaxMoney(target);
      const currentMoney = ns.getServerMoneyAvailable(target);
      const securityLevel = ns.getServerSecurityLevel(target);
      const minSecurity = ns.getServerMinSecurityLevel(target);
  
      switch (operation) {
        case 'hack':
          return Math.floor(ns.hackAnalyzeThreads(target, currentMoney * config.moneyThreshold));
        case 'grow':
          return Math.ceil(ns.growthAnalyze(target, maxMoney / Math.max(currentMoney * (1 - config.moneyThreshold), 1)));
        case 'weaken':
          return Math.ceil((securityLevel - minSecurity) / 0.05) + 1;
        default:
          return 0;
      }
    }
  
    // Allocate threads across servers
    async function distributeOperation(script, threads, target, delay, servers) {
      const executionPromises = [];
      servers.sort((a, b) => (a === "home" ? -1 : 1));
  
      for (const server of servers) {
        if (threads <= 0) break;
  
        const availableRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        const scriptRam = ns.getScriptRam(script);
        const maxThreads = Math.floor(availableRam / scriptRam);
        const threadsToRun = Math.min(threads, maxThreads);
  
        if (threadsToRun > 0) {
          await ns.scp(script, server);
          executionPromises.push(ns.exec(script, server, threadsToRun, target, delay));
          threads -= threadsToRun;
        }
      }
  
      await Promise.all(executionPromises);
    }
  
    // Execute a batch on a target
    async function executeBatch(target, servers) {
      const weakenTime = ns.getWeakenTime(target);
      const growTime = ns.getGrowTime(target);
      const hackTime = ns.getHackTime(target);
  
      const operations = [
        { script: "weaken.js", threads: calculateThreads(target, "weaken"), delay: 0 },
        { script: "hack.js", threads: calculateThreads(target, "hack"), delay: weakenTime - hackTime - 3 * config.batchDelay },
        { script: "grow.js", threads: calculateThreads(target, "grow"), delay: weakenTime - growTime - 2 * config.batchDelay },
        { script: "weaken.js", threads: Math.ceil(calculateThreads(target, "hack") / 25 + calculateThreads(target, "grow") / 12.5), delay: config.batchDelay },
      ];
  
      log(`[BATCH STARTED] Target: ${target} | Servers: ${servers.length}`, "ACTION");
  
      for (const op of operations) {
        await distributeOperation(op.script, op.threads, target, op.delay, servers);
      }
  
      log(`[ACTIONED] Batch executed on ${target}`, "SUCCESS");
    }
  
    // Continuous monitoring and execution
    while (true) {
      const { targets, availableServers } = getEligibleTargetsAndServers();
      const servers = ["home", ...availableServers];
  
      for (const target of targets) {
        const securityLevel = ns.getServerSecurityLevel(target);
        const minSecurity = ns.getServerMinSecurityLevel(target);
        const currentMoney = ns.getServerMoneyAvailable(target);
        const maxMoney = ns.getServerMaxMoney(target);
  
        if (securityLevel <= minSecurity + config.securityThreshold && currentMoney >= maxMoney * config.moneyThreshold) {
          await executeBatch(target, servers);
        } else {
          log(`[SKIPPED] ${target} | Security: ${securityLevel.toFixed(2)} | Money: ${((currentMoney / maxMoney) * 100).toFixed(2)}%`, "INFO");
        }
      }
  
      await ns.sleep(config.batchDelay);
    }
  }
