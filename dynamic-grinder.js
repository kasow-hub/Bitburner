/** @param {NS} ns **/
export async function main(ns) {
    
    const securityBuffer = 3;
    const moneyThresholdPercentage = 0.80;
    const batchDelay = 200;
    const ratios = { weaken: 0.4, grow: 0.5, hack: 0.1 };
    const hostServer = ns.getHostname();
  
    const hackScript = "hack.js";
    const growScript = "grow.js";
    const weakenScript = "weaken.js";
  
    ns.disableLog("ALL");
  
    // Function to get a list of purchased servers
    function getPurchasedServers(ns) {
      try {
        return ns.getPurchasedServers();
      } catch (error) {
        ns.print(`ERROR: Could not get purchased servers: ${error}`);
        return [];
      }
    }
  
    // Function to get all servers with root access and sufficient hacking level
    async function getEligibleTargets(ns, excludedServers) {
      try {
        const allServers = await getAllServers(ns);
        const hackingLevel = ns.getHackingLevel();
        const eligibleTargets = [];
  
        for (const server of allServers) {
          if (excludedServers.includes(server) || !ns.hasRootAccess(server)) continue;
          if (ns.getServerRequiredHackingLevel(server) > hackingLevel) {
            ns.print(`INFO: Skipping ${server} - Hacking level too low.`);
            continue;
          }
          if (ns.getServerMaxMoney(server) <= 0) {
            ns.print(`INFO: Skipping ${server} - Max money is zero.`);
            continue;
          }
          if (ns.getServerMoneyAvailable(server) <= 0) {
            ns.print(`INFO: Skipping ${server} - Current money is zero.`);
            continue;
          }
          eligibleTargets.push(server);
        }
        return eligibleTargets;
      } catch (error) {
        ns.print(`ERROR: Error in getEligibleTargets: ${error}`);
        return [];
      }
    }
  
    // Function to scan all servers in the network
    async function getAllServers(ns) {
      try {
        const servers = new Set(['home']);
        const queue = ['home'];
  
        while (queue.length > 0) {
          const server = queue.shift();
          const neighbors = ns.scan(server);
          for (const neighbor of neighbors) {
            if (!servers.has(neighbor)) {
              servers.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        return Array.from(servers);
      } catch (error) {
        ns.print(`ERROR: Error in getAllServers: ${error}`);
        return [];
      }
    }
  
    // Helper function to calculate threads based on RAM usage
    function calculateThreads(ns, script, ratio) {
      try {
        const maxRam = ns.getServerMaxRam(hostServer);
        const usedRam = ns.getServerUsedRam(hostServer);
        const freeRam = maxRam - usedRam;
  
        if (freeRam <= 0) {
          ns.print(`WARNING: No free RAM available on ${hostServer}. RAM: ${freeRam}`);
          return 0; // Return zero if no free RAM
        }
  
        const scriptRam = ns.getScriptRam(script, hostServer);
        if (scriptRam <= 0) {
          ns.print(`ERROR: Script ${script} has invalid RAM usage. Check log.`);
          return 0; // Return zero if script RAM is invalid
        }
  
        return Math.floor((freeRam * ratio) / scriptRam);
      } catch (error) {
        ns.print(`ERROR: Error in calculateThreads: ${error}`);
        return 0;
      }
    }
  
    // Helper function to execute a script with calculated threads
    async function executeScript(ns, script, target, ratio) {
      let threads;
      try {
        threads = calculateThreads(ns, script, ratio);
  
        if (threads > 0) {
          const pid = ns.exec(script, hostServer, threads, target);
          if (pid > 0) {
            ns.print(`INFO: Executing ${script} on ${target} with ${threads} threads.`);
          } else {
            ns.print(`ERROR: Failed to execute ${script} on ${target}.`);
          }
        } else {
          ns.print(`WARNING: Not enough RAM to execute ${script} on ${target}.`);
        }
      } catch (error) {
        ns.print(`ERROR: Error in executeScript: ${error}`);
      }
  
      // Handle 'not enough RAM' errors by waiting and retrying
      if (threads === 0) {
        ns.print(`\nWARNING: Waiting for available RAM to execute ${script} on ${target}...`);
        await ns.sleep(100);
        return executeScript(ns, script, target, ratio); // Recursive call to retry
      }
    }
  
    while (true) {
      try {
        const purchasedServers = getPurchasedServers(ns);
        const excludedServers = ["home", ...purchasedServers];
        const targets = await getEligibleTargets(ns, excludedServers);
  
        if (targets.length === 0) {
          ns.print("WARNING: No eligible targets found. Sleeping...");
          await ns.sleep(100);
          continue;
        }
  
        for (const target of targets) {
          try {
            const currentSecurity = ns.getServerSecurityLevel(target);
            const minSecurity = ns.getServerMinSecurityLevel(target);
            const maxMoney = ns.getServerMaxMoney(target);
            const currentMoney = ns.getServerMoneyAvailable(target);
  
            ns.print(`\n----- Target: ${target} -----`);
            ns.print(`- Security: ${currentSecurity.toFixed(2)} (Min: ${minSecurity.toFixed(2)}, Buffer: +${securityBuffer})`);
            ns.print(`- Money: $${ns.formatNumber(currentMoney)} / $${ns.formatNumber(maxMoney)} (${(currentMoney / maxMoney * 100).toFixed(2)}%)`);
            ns.print(`- Host: ${hostServer}`);
  
            // Determine action based on thresholds
            if (currentSecurity > minSecurity + securityBuffer) {
              ns.print(`-> ACTION: Weakening ${target}`);
              await executeScript(ns, weakenScript, target, ratios.weaken);
            } else if (currentMoney < maxMoney * moneyThresholdPercentage) {
              ns.print(`-> ACTION: Growing ${target}`);
              await executeScript(ns, growScript, target, ratios.grow);
            } else {
              ns.print(`-> ACTION: Hacking ${target}`);
              await executeScript(ns, hackScript, target, ratios.hack);
            }
  
            await ns.sleep(batchDelay);
          } catch (innerError) {
            ns.print(`ERROR: Inner loop failed for target ${target}: ${innerError}`);
          }
        }
  
        await ns.sleep(50);
      } catch (outerError) {
        ns.print(`ERROR: Outer loop failed: ${outerError}`);
      }
    }
  }
  