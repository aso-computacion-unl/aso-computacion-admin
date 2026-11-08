import { BudgetedMailSender } from "@/application";
import { InMemoryMailBudget, RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

/**
 * The mail sender every unit test sees instead of the Gmail-backed one (installed for all tests by
 * `auth-doubles.setup.ts`): the real budgeted sender over a recording transport and an in-memory daily budget.
 * Tests flip `configured` and `dailyLimit` to drive the refusals.
 */
export const testMail = {
  transport: new RecordingMailTransport(),
  budget: new InMemoryMailBudget(),
  configured: true,
  dailyLimit: 400,
};

export function getTestMailSender() {
  return new BudgetedMailSender(testMail.configured ? testMail.transport : null, testMail.budget, testMail.dailyLimit);
}

export function resetTestMail(): void {
  testMail.transport.delivered.length = 0;
  testMail.transport.failing.clear();
  testMail.budget = new InMemoryMailBudget();
  testMail.configured = true;
  testMail.dailyLimit = 400;
}
