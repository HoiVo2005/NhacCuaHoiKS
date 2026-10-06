/**
 * Test hanh vi THUC cua co de BO QUA ghi khi noi dung khong doi (chay duong browser voi localStorage gia):
 *   npx tsx scripts/tmp-test-skip-write.ts
 */
const writes: string[] = [];
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: () => null,
    setItem: (name: string, value: string) => writes.push(`${name}:${value}`),
    removeItem: () => undefined,
  },
  document: { visibilityState: "visible" },
  addEventListener: () => undefined,
};

async function main(): Promise<void> {
  const { createThrottledPersistStorage } = await import("../src/lib/throttled-storage");

  interface TestState {
    volume: number;
    queue: { id: string }[];
  }

  const delayMs = 30;
  const storage = createThrottledPersistStorage<TestState>(delayMs);
  const queue = [{ id: "a" }];
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Ghi lan dau tien (chua co gi tren dia)
  await storage.setItem("k", { state: { volume: 1, queue }, version: 0 });
  await sleep(delayMs + 20);
  console.log(`1. Lan dau ghi: ${writes.length === 1 ? "PASS" : `FAIL (${writes.length})`}`);

  // 2. 3 lan setItem noi dung GIONG het (moi partialize tao object moi) -> van chi 1 ghi
  for (let i = 0; i < 3; i++) {
    await storage.setItem("k", { state: { volume: 1, queue }, version: 0 });
  }
  await sleep(delayMs + 20);
  console.log(
    `2. Noi dung khong doi -> khong ghi lai: ${writes.length === 1 ? "PASS" : `FAIL (${writes.length})`}`,
  );

  // 3. Doi gia tri thuc -> ghi them
  await storage.setItem("k", { state: { volume: 2, queue }, version: 0 });
  await sleep(delayMs + 20);
  console.log(`3. Trang thai doi -> ghi: ${writes.length === 2 ? "PASS" : `FAIL (${writes.length})`}`);

  // 4. Doi roi quay lai gia tri cu TRONG cua so throttle -> huy ban ghi dang cho (khong ghi thua)
  await storage.setItem("k", { state: { volume: 3, queue }, version: 0 });
  await storage.setItem("k", { state: { volume: 2, queue }, version: 0 });
  await sleep(delayMs + 20);
  console.log(
    `4. Quay lai gia tri da luu -> huy pending: ${writes.length === 2 ? "PASS" : `FAIL (${writes.length})`}`,
  );

  // 5. Queue doi tham chieu (nhu zustand tao mang moi) -> ghi
  await storage.setItem("k", { state: { volume: 2, queue: [{ id: "b" }] }, version: 0 });
  await sleep(delayMs + 20);
  console.log(`5. Queue doi -> ghi: ${writes.length === 3 ? "PASS" : `FAIL (${writes.length})`}`);

  console.log(`\nTONG: ${writes.length} lan ghi (ky vong 3)`);
}

void main();
