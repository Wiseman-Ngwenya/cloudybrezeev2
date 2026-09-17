// CloudyBreeze interest-test lead writer.
// Uses the Supabase REST endpoint with INSERT-only access.
// It intentionally does not request or return inserted rows, so the
// experiment_leads table can remain unreadable to public visitors.
(function () {
    'use strict';

    var SUPABASE_URL = 'https://xtcumrmayetcihqmtqkx.supabase.co';
    var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vHvVfT1349nefV3o1a7--g_HVSPuFDT';

    function install(attemptNumber) {
        var tracker = window.CloudyBreezeExperiment;

        if (tracker && typeof tracker.getSessionId === 'function') {
            tracker.saveLead = function (input) {
                input = input && typeof input === 'object' ? input : {};

                var payload = Object.assign({}, input, {
                    session_id: tracker.getSessionId()
                });

                return fetch(SUPABASE_URL + '/rest/v1/experiment_leads', {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_PUBLISHABLE_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_PUBLISHABLE_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                }).then(function (response) {
                    if (!response.ok) {
                        return response.text().then(function (message) {
                            return {
                                success: false,
                                error: new Error(message || 'Unable to save interest')
                            };
                        });
                    }

                    return { success: true };
                }).catch(function (error) {
                    return { success: false, error: error };
                });
            };

            return;
        }

        if (attemptNumber < 30) {
            window.setTimeout(function () {
                install(attemptNumber + 1);
            }, 100);
        }
    }

    install(0);
})();
