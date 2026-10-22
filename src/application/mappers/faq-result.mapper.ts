import type { Faq } from "@/domain/faq";

import type { FaqResult } from "../dto/faq-result.dto";

export function toFaqResult(faq: Faq): FaqResult {
  return { ...faq.props };
}
