/**
 * TinCanJS - Minimal, robust standalone xAPI client library for Web Media Wrappers
 * Based on ADL / Rustici Software xAPI (Tin Can) specification
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TinCan = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function TinCan(options) {
        options = options || {};
        this.recordStores = [];
        this.actor = options.actor || null;
        this.activity = options.activity || null;
        this.registration = options.registration || null;

        if (options.recordStores && Array.isArray(options.recordStores)) {
            for (var i = 0; i < options.recordStores.length; i++) {
                this.addRecordStore(options.recordStores[i]);
            }
        } else if (options.url || options.endpoint) {
            this.addRecordStore(options);
        }
    }

    TinCan.prototype.addRecordStore = function (cfg) {
        var lrs = new TinCan.LRS(cfg);
        this.recordStores.push(lrs);
        return lrs;
    };

    TinCan.prototype.sendStatement = function (statement, callback) {
        if (!statement) return;
        if (!statement.actor && this.actor) {
            statement.actor = this.actor;
        }
        if (!statement.timestamp) {
            statement.timestamp = (new Date()).toISOString();
        }

        var results = [];
        var pending = this.recordStores.length;
        if (pending === 0) {
            if (callback) callback(new Error("No LRS configured"), null);
            return;
        }

        for (var i = 0; i < this.recordStores.length; i++) {
            this.recordStores[i].saveStatement(statement, function (err, res) {
                if (err) results.push({ error: err });
                else results.push({ response: res });
                pending--;
                if (pending === 0 && callback) {
                    callback(null, results);
                }
            });
        }
    };

    TinCan.LRS = function (cfg) {
        cfg = cfg || {};
        var endpoint = cfg.endpoint || cfg.url || "";
        // Ensure endpoint ends with /
        if (endpoint && endpoint.slice(-1) !== '/') {
            endpoint += '/';
        }
        this.endpoint = endpoint;
        this.auth = cfg.auth || "";
        this.version = cfg.version || "1.0.3";
    };

    TinCan.LRS.prototype.saveStatement = function (statement, callback) {
        var url = this.endpoint + "statements";
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
        xhr.setRequestHeader("X-Experience-API-Version", this.version);

        if (this.auth) {
            var authHeader = this.auth;
            if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
                authHeader = "Basic " + authHeader;
            }
            xhr.setRequestHeader("Authorization", authHeader);
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    var parsed = null;
                    try {
                        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : [statement.id || true];
                    } catch (e) {
                        parsed = xhr.responseText;
                    }
                    if (callback) callback(null, parsed);
                } else {
                    var err = new Error("LRS HTTP Error " + xhr.status + ": " + xhr.responseText);
                    err.status = xhr.status;
                    err.responseText = xhr.responseText;
                    if (callback) callback(err, null);
                }
            }
        };

        try {
            xhr.send(JSON.stringify(statement));
        } catch (err) {
            if (callback) callback(err, null);
        }
    };

    TinCan.LRS.prototype.queryStatements = function (params, callback) {
        var queryParts = [];
        for (var key in params) {
            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
                queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
            }
        }
        var url = this.endpoint + "statements" + (queryParts.length > 0 ? "?" + queryParts.join("&") : "");
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("X-Experience-API-Version", this.version);
        if (this.auth) {
            var authHeader = this.auth;
            if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
                authHeader = "Basic " + authHeader;
            }
            xhr.setRequestHeader("Authorization", authHeader);
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var parsed = JSON.parse(xhr.responseText);
                        if (callback) callback(null, parsed);
                    } catch (e) {
                        if (callback) callback(e, null);
                    }
                } else {
                    var err = new Error("Query error " + xhr.status + ": " + xhr.responseText);
                    if (callback) callback(err, null);
                }
            }
        };

        xhr.send();
    };

    // Standard Articulate 360 / xAPI URL parameter parser helper
    TinCan.fromQueryParams = function () {
        var params = new URLSearchParams(window.location.search);
        var endpoint = params.get("endpoint") || "";
        var auth = params.get("auth") || "";
        var actorRaw = params.get("actor") || "";
        var activityId = params.get("activity_id") || "";
        var registration = params.get("registration") || "";

        var actor = null;
        if (actorRaw) {
            try {
                actor = JSON.parse(actorRaw);
            } catch (e) {
                console.warn("[TinCan] Could not JSON parse actor parameter:", actorRaw);
                actor = { name: actorRaw, mbox: "mailto:" + actorRaw };
            }
        }

        // Standardize Articulate array structure: {"name":["Jane Doe"],"mbox":["mailto:jane@example.com"]}
        if (actor) {
            if (Array.isArray(actor.name)) actor.name = actor.name[0];
            if (Array.isArray(actor.mbox)) actor.mbox = actor.mbox[0];
        }

        return new TinCan({
            endpoint: endpoint,
            auth: auth,
            actor: actor,
            activity: activityId,
            registration: registration
        });
    };

    // Standard xAPI Verbs
    TinCan.Verbs = {
        launched: {
            id: "http://adlnet.gov/expapi/verbs/launched",
            display: { "en-US": "launched" }
        },
        initialized: {
            id: "http://adlnet.gov/expapi/verbs/initialized",
            display: { "en-US": "initialized" }
        },
        progressed: {
            id: "http://adlnet.gov/expapi/verbs/progressed",
            display: { "en-US": "progressed" }
        },
        experienced: {
            id: "http://adlnet.gov/expapi/verbs/experienced",
            display: { "en-US": "experienced" }
        },
        completed: {
            id: "http://adlnet.gov/expapi/verbs/completed",
            display: { "en-US": "completed" }
        },
        passed: {
            id: "http://adlnet.gov/expapi/verbs/passed",
            display: { "en-US": "passed" }
        },
        terminated: {
            id: "http://adlnet.gov/expapi/verbs/terminated",
            display: { "en-US": "terminated" }
        }
    };

    return TinCan;
}));
