/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0];
  const delay = ns.args[1] || 0;
  const batchId = ns.args[2] || "N/A";
  if (!target) {
    ns.print("No target specified for hack.");
    return;
  }
  ns.print(`Batch ${batchId}: Hack scheduled for ${target} with delay ${delay}ms.`);
  await ns.sleep(delay);
  try {
    const result = await ns.hack(target);
    ns.print(`Batch ${batchId}: Hack on ${target} returned ${result}.`);
  } catch (e) {
    ns.print(`Batch ${batchId}: Error during hack on ${target}: ${e}`);
  }
}
