/** @param {NS} ns **/
export async function main(ns) {

  const targets = ns.args.length > 0 ? ns.args : [ns.getHostname()]; // Default target servers
  const securityBuffer = 5; // Security level buffer
  const moneyThresholdPercentage = 0.75; // Hack only if money is above 75% of max
  const batchDelay = 20; // Delay between batches (ms)
  const ratios = { weaken: 0.3, grow: 0.6, hack: 0.1 }; // RAM allocation ratios
  const hostServer = ns.getHostname(); // Define the host server [4]

  const hackScript = "hack.js";
  const growScript = "grow.js";
  const weakenScript = "weaken.js";

  ns.disableLog("ALL");

  // Helper function to calculate threads based on RAM usage
  function calculateThreads(ns, script, ratio) {
    try {
      const maxRam = ns.getServerMaxRam(hostServer);
      const usedRam = ns.getServerUsedRam(hostServer);
      const freeRam = maxRam - usedRam;

      if (freeRam <= 0) {
        ns.print(`WARNING: No free RAM available on ${hostServer}.`);
        return 0;
      }

      const scriptRam = ns.getScriptRam(script, hostServer);
      if (scriptRam <= 0) {
        ns.print(`ERROR: Script ${script} has invalid RAM usage.`);
        return 0;
      }

      const threads = Math.floor((freeRam * ratio) / scriptRam);
      return Math.max(0, threads);
    } catch (error) {
      ns.print(`ERROR: calculateThreads failed: ${error.message}`);
      return 0;
    }
  }

  // Helper function to execute a script with calculated threads
  async function executeScript(ns, script, target, ratio) {
    try {
      const threads = calculateThreads(ns, script, ratio);

      if (threads > 0) {
        const pid = ns.exec(script, hostServer, threads, target);
        if (pid > 0) {
          ns.print(`INFO: Executing ${script} on ${target} with ${threads} threads.`);
        } else {
          ns.print(`ERROR: Failed to execute ${script} on ${target}.`);
        }
      } else if (threads === 0) {
        ns.print(`WARNING: Not enough RAM to execute ${script} on ${target}.`);
      }
    } catch (error) {
      ns.print(`ERROR: executeScript failed for ${script} on ${target}: ${error.message}`);
    }
  }

  while (true) {
    try {
      for (const target of targets) {
        try {
          if (!ns.hasRootAccess(target)) {
            ns.print(`ERROR: No root access to ${target}. Skipping.`);
            continue;
          }
         
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
            ns.print(`------------ *** ------------`);
            await executeScript(ns, weakenScript, target, ratios.weaken);
          } else if (currentMoney < maxMoney * moneyThresholdPercentage) {
            ns.print(`-> ACTION: Growing ${target}`);
            ns.print(`------------ *** ------------`);
            await executeScript(ns, growScript, target, ratios.grow);
          } else {
            ns.print(`-> ACTION: Hacking ${target}`);
            await executeScript(ns, hackScript, target, ratios.hack);
            ns.print(`------------ *** ------------`);
          }

          await ns.sleep(batchDelay);
        } catch (innerError) {
          ns.print(`ERROR: Inner loop failed for target ${target}: ${innerError.message}`);
        }
      }
      
      await ns.sleep(50);
    } catch (outerError) {
      ns.print(`ERROR: Outer loop failed: ${outerError.message}`);
    }
  }
}
