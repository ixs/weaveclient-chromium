/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Weave Client for Chromium
 *
 * The Initial Developer of the Original Code is Philipp von Weitershausen.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Martin Reckziegel
 * Andreas Thienemann
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Weave.Chromium = {

    options: null,
    status: "disconnected",

    init: function () {
        Weave.Chromium.Tabs.init();
        Weave.Chromium.Bookmarks.init();

        if (localStorage.options) {
            this.options = JSON.parse(localStorage.options);
            return;
        }

        // Ok, we're running for the first time.  Let's initialize the
        // options object.  In particular we need to generate a client ID.
        this.options = {};
        for (var key in Weave.Client.default_options) {
            this.options[key] = Weave.Client.default_options[key];
        }
        var clientGUID = Weave.Util.makeGUID();
        this.options.client = {id: clientGUID,
                               name: "Google Chrome (" + clientGUID + ")",
                               type: "desktop"};
        this.saveOptions();
    },

    saveOptions: function () {
        localStorage.options = JSON.stringify(this.options);
    },

    clearCache: function () {
        delete localStorage['bookmarks'];
        delete localStorage['tabs'];
        delete localStorage['bookmark.folders'];
        delete localStorage['bookmark.chromeIDs'];
        this.init();
    },

    connect: function () {
        var self = this;
        //TODO ensure that we're configured (user, password, etc.)
        this.saveOptions();

        var errback = function() {
            console.log.apply(console,arguments);
        }

        this.status = "connecting";
        this.sendEvent("WeaveSyncConnecting");

        Weave.Client.connect(this.options);
        Weave.Client.ensureUserStorageNode(function () {
            Weave.Client.checkStorageVersion(function() {
                Weave.Client.ensureKeys(function () {
                    Weave.Client.ensureClientGUID(function () {
                        self.status = "connected";
                        self.sendEvent("WeaveSyncConnected");
                    },errback);
                },errback);
            },errback);
        },errback);
    },

    disconnect: function () {
        Weave.Client.disconnect();
        this.status = "disconnected";
        this.sendEvent("WeaveSyncDisconnected");
    },

    reset: function () {
        delete localStorage.options;
        this.init();
    },

    sync: function () {
        this.status = "syncing";
        this.sendEvent("WeaveSyncSyncBegin");

        var count = 0;
        var self = this;
        function areWeDoneYet () {
            count += 1;
            if (count === 2) {
                self.status = "connected";
                self.sendEvent("WeaveSyncSyncEnd");
            }
        }

        //TODO these should be running after each other, not in parallel
        Weave.Chromium.Tabs.sync(areWeDoneYet);
        Weave.Chromium.Bookmarks.sync(areWeDoneYet);
    },

    sendEvent: function (type) {
        var event = document.createEvent("Event");
        event.initEvent(type, true, true);
        window.dispatchEvent(event);
    }
};

//TODO factor the generic parts out into a storage baseobject
Weave.Chromium.Tabs = {

    collection: "tabs",
    wbos: null,
    lastSync: null, //TODO

    init: function () {
        if (localStorage[this.collection]) {
            this.wbos = JSON.parse(localStorage[this.collection]);
            return;
        }

        this.wbos = {};
        this.save();
    },

    save: function () {
        localStorage[this.collection] = JSON.stringify(this.wbos);
    },

    sync: function (callback) {
        var self = this;
        Weave.Client.loadCollectionDecrypt(self.collection, {full: 1}, function (datain) {
            self.syncWBOs(datain, function (dataout) {
                Weave.Client.encryptPostCollection(self.collection, dataout,
                                                   function (status) {
                    //TODO examine status.success, status.failed
                    callback();
                });
            });
        });
    },


    // Receives new WBOs, returns a list of WBOs to be updated (via callback).
    syncWBOs: function (data, callback) {
        var self = this;

        // With tabs it's easy.  We just replace whatever we have
        // locally with the new stuff.
        data.forEach(function (wbo) {
            self.wbos[wbo.id] = wbo;
        });

        // The outgoing data simply is one WBO containing a list of
        // all tabs in all windows.
        chrome.windows.getAll({populate:true}, function (windows) {
            var tab;
            var weaveTabs = [];
            for (var i=0; i < windows.length; i++) {
                for (var j=0; j < windows[i].tabs.length; j++) {
                    tab = windows[i].tabs[j];
                    if (tab.url.substr(0, 4) !== "http") {
                        continue;
                    }
                    weaveTabs.push({icon: tab.favIconUrl,
                                    lastUsed: Date.now(), //XXX a lie
                                    title: tab.title,
                                    urlHistory: [tab.url]});
                }
            }

            // Assemble WBO
            var options = Weave.Chromium.options;
            var wbo = {id: options.client.id,
                       clientName: options.client.name,
                       tabs: weaveTabs};
            self.wbos[wbo.id] = wbo;
            self.save();

            callback([wbo]);
        });
    }
};


Weave.Chromium.Bookmarks = {

    collection: "bookmarks",
    wbos: null,
    lastSync: null, //TODO

    folders: null,   // folder name --> chrome ID
    chromeIDs: null, // chrome ID --> WBO ID


    init: function () {
        if (localStorage[this.collection]) {
            this.wbos = JSON.parse(localStorage[this.collection]);
            this.folders = JSON.parse(localStorage['bookmark.folders']);
            this.chromeIDs = JSON.parse(localStorage['bookmark.chromeIDs']);
            return;
        }

        this.wbos = {};
        this.folders = {};
        this.chromeIDs = {};
        this.save();
    },

    save: function () {
        localStorage[this.collection] = JSON.stringify(this.wbos);
        localStorage["bookmark.folders"] = JSON.stringify(this.folders);
        localStorage["bookmark.chromeIDs"] = JSON.stringify(this.chromeIDs);
    },

    sync: function (callback) {
        var self = this;
        Weave.Client.loadCollectionDecrypt(self.collection, {full: 1}, function (datain) {
            self.syncWBOs(datain, function (dataout) {
                Weave.Client.encryptPostCollection(self.collection, dataout,
                                                   function (status) {
                    //TODO examine status.success, status.failed
                    callback();
                });
            });
        });
    },

    wboToBookmark: function (defaultParent, wbo) {
        var params;

        var parentId = this.folders[wbo.parentName];
        if (parentId === undefined) {
            parentId = defaultParent.id;
        }

        switch (wbo.type) {
        case "bookmark":
            params = {
                parentId: parentId,
                title: wbo.title || wbo.bmkUri,
                url: wbo.bmkUri,
                //TODO index
            };
            break

        case "folder":
            params = {
                parentId: parentId,
                title: wbo.title,
                //TODO index
            };
            break;

        default:
            return;
        }

        console.debug("New bookmark", params);

        var self = this;
        chrome.bookmarks.create(params, function (node) {
            wbo.chromeID = node.id;
            self.chromeIDs[node.id] = wbo.id;
            self.wbos[wbo.id] = wbo;
            if (wbo.type === "folder") {
                self.folders[wbo.title] = node.id;
            }
        });
    },

    bookmarkToWBO: function (node) {
        var uuid = "{" + Weave.Util.makeUUID() + "}";
        var parentUUID = this.chromeIDs[node.parentId];
        var parentWBO = this.wbos[parentUUID];

        var wbo = {
            id: uuid,
            modified: Date.now(),
            title: node.title,
            type: node.url ? "bookmark" : "folder",
            bmkUri: node.url,
            parentName: parentWBO ? parentWBO.title : undefined,
            chromeID: node.id
        };

        this.chromeIDs[node.id] = wbo.id;
        this.wbos[wbo.id] = wbo;
        if (wbo.type === "folder") {
            this.folders[wbo.title] = node.id;
        }

        return wbo;
    },


    // Receives new WBOs, returns a list of WBOs to be updated (via callback)
    syncWBOs: function (data, callback) {
        var self = this;

        chrome.bookmarks.getTree(function (topNodes) {
            // Is there ever going to be more than one top node?
            // Now topNodes contains the standard folders,
            // e.g. "Bookmarks Bar" and "Other Bookmarks"
            topNodes = topNodes[0].children;

            // Process new and updated bookmarks
            data.forEach(function (newwbo) {
                var wbo = self.wbos[newwbo.id];
                if (wbo === undefined) {
                    self.wboToBookmark(topNodes[0], newwbo);
                    return;
                }

                // Bookmark is already present.  Check if it has changed.
                if (newwbo.modified > wbo.modified) {
                    //TODO check whether the bookmark has changed its
                    // position (parent, index, etc.).  Check for folder
                    // renames (waaa!)
                    chrome.bookmarks.update(wbo.chromeID, {
                        title: newwbo.title,
                        url: newwbo.bmkUri
                    });
                    for (var key in newwbo) {
                        wbo[key] = newwbo[key];
                    }
                }
            });

            // Push WBOs out for new and updated (TODO) bookmarks
            var wbos = [];
            function walkNode (node) {
                if (self.chromeIDs[node.id] === undefined) {
                    var wbo = self.bookmarkToWBO(node);
                    wbos.push(wbo);
                }
                //TODO possibly check whether the bookmark has changed
                // and update the WBO

                if (node.children) {
                    node.children.forEach(walkNode);
                }
            }

            topNodes.forEach(walkNode);
            self.save();
            callback(wbos);
        });
    }

};
