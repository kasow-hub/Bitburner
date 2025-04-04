/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0];
  const delay = ns.args[1] || 0;
  const batchId = ns.args[2] || "N/A";
  if (!target) {
    ns.print("No target specified for grow.");
    return;
  }
  ns.print(`Batch ${batchId}: Grow scheduled for ${target} with delay ${delay}ms.`);
  await ns.sleep(delay);
  try {
    const result = await ns.grow(target);
    ns.print(`Batch ${batchId}: Grow on ${target} returned ${result}.`);
  } catch (e) {
    ns.print(`Batch ${batchId}: Error during grow on ${target}: ${e}`);
  }
}
