import { z } from "zod";

import { formText, parseStrictForm } from "../admin/form-fields";

// Length rules live in the domain. The browser submits line breaks as CRLF; the domain normalises them.
const threadFormSchema = z.strictObject({ title: formText, body: formText });
const replyFormSchema = z.strictObject({ body: formText });

export const parseThreadFormData = (formData: FormData) => parseStrictForm(threadFormSchema, formData);
export const parseReplyFormData = (formData: FormData) => parseStrictForm(replyFormSchema, formData);
