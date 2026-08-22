-- Replace the stand-in financing copy with the client-confirmed terms.
--
-- The client has not yet supplied a lender or specific promotional terms, so
-- no lender is named here. The only rate claim is the one they confirmed:
-- as low as 0% APR, with the actual rate set by the applicant's credit.
--
-- jsonb_set touches only the 'financing' key so anything the client has
-- edited in the admin CMS since the last deploy is preserved.

update content
set data = jsonb_set(data, '{financing}', $financing${"enabled": true, "heading": "Financing available", "body": "Financing is available for qualifying customers, with rates as low as 0% APR. Your rate and term are based on your credit, so we'll go over your exact numbers with your quote.", "toggleLabel": "How financing works →", "points": ["Rates start as low as 0% APR for customers who qualify.", "Your rate, term and approved amount depend on your credit profile and the size of the project.", "Financing is arranged through a third-party lender — 530 Spray Foam is not the lender.", "Ask about financing at your free walkthrough and we'll go over the options open to you."]}$financing$::jsonb, true),
    updated_at = now()
where id = 1;
