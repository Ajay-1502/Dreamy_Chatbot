DREAMY HYBRID V1 — FAQ DATABASE UPDATE

Files in this folder:

- server.js: Express backend with FAQ-first routing, Groq fallback and lead saving.
- faq-data.js: 100 approved FAQ scenarios grouped into 10 categories.
- system-prompt.txt: Dreamy instructions and approved company information.

INSTALLATION

1. Back up your existing server.js, system-prompt.txt and faq-data.js.
2. Copy the three files from this folder into your existing project folder, replacing the old versions.
3. Keep your public/ folder, package.json, package-lock.json and .env file.
4. Make sure the .env file contains GROQ_API_KEY for live AI replies. Without it, recognized FAQs still work but non-FAQ questions receive a test-mode message.
5. Start the server using: node server.js

FAQ COVERAGE
The FAQ database contains 100 distinct scenarios, arranged as ten groups:

1. Company information
2. Website development
3. E-commerce
4. Digital marketing
5. Domain, hosting and business email
6. Pricing and payments
7. Portfolio and industries
8. Training
9. Contact and support
10. Additional solutions and policies

HOW ROUTING WORKS

- Recognized English FAQ questions are answered directly from faq-data.js without a Groq API call.
- Questions that do not match an approved FAQ phrase go to Groq when GROQ_API_KEY is configured.
- Kannada, Hindi and Marathi messages go to Groq so Dreamy can reply in the visitor's language.
- Callback/contact-detail conversations go to Groq, including conversations that began with an FAQ, so save_lead remains available.
- If two FAQ scenarios match equally well, the matcher returns no FAQ and lets Groq handle the ambiguity rather than guessing.

IMPORTANT MATCHING LIMITATION
These are 100 distinct FAQ scenarios with example phrasings, not a guarantee that every possible way of asking a question will match. Phrase matching is deterministic, not semantic. If a visitor uses wording that is not represented, the question will go to Groq. Add new approved phrasings to the relevant FAQ entry as you observe them.

TEST QUESTIONS

- How many clients have you served? → 1,200+ clients.
- How long does a business website take? → 2 to 4 weeks for a standard business website.
- Do you accept UPI or bank transfer? → approved payment-method answer.
- Can you integrate shipping and delivery? → approved e-commerce answer.
- Do you provide English to Japanese translation? → approved translation answer.
- What are your office hours? → 10 AM to 7 PM.

LEAD TESTING

- The automatic save_lead tool is active only when Groq is configured and the AI path is used.
- In local TEST MODE, use /api/test-lead to test local lead-file writing. This does not test Groq tool calling.
