#!/bin/bash
# End-to-end test of the deployed Sea Monkey web app.
# Sends PAYLOAD_FULL with auto_send=true. Dropbox Sign test_mode=1 means no real send.

URL='https://script.google.com/macros/s/AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy/exec'
PAYLOAD="$(dirname "$0")/test-payload-full.json"

curl -L -X POST \
  -H 'Content-Type: application/json' \
  --data "@${PAYLOAD}" \
  "$URL"
echo
