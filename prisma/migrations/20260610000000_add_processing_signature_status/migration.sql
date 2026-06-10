-- Rows are created as 'processing' on the synchronous Dropbox Sign accept and
-- promoted to 'sent' by the signature_request_sent webhook.
ALTER TYPE "signature_status" ADD VALUE 'processing';
