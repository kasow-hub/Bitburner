/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0];
  const delay = ns.args[1] || 0;
  const batchId = ns.args[2] || "N/A";
  if (!target) {
    ns.print("No target specified for weaken.");
    return;
  }
  ns.print(`Batch ${batchId}: Weaken scheduled for ${target} with delay ${delay}ms.`);
  await ns.sleep(delay);
  try {
    const result = await ns.weaken(target);
    ns.print(`Batch ${batchId}: Weaken on ${target} returned ${result}.`);
  } catch (e) {
    ns.print(`Batch ${batchId}: Error during weaken on ${target}: ${e}`);
  }
}
