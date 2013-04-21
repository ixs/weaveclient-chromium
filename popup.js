var background = chrome.extension.getBackgroundPage();
var Weave = background.Weave;

var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];


function onLoad () {
    jQuery('#connect-button').click(onItemClick(onConnectButton));
    jQuery('#sync-button').click(onItemClick(onSyncButton));
    jQuery('#options').click(openPage('options.html'));
    jQuery('#tabs').click(openPage('tabs.html'));

    background.addEventListener("WeaveSyncConnecting", onConnecting, false);
    background.addEventListener("WeaveSyncConnected", onConnected, false);
    background.addEventListener("WeaveSyncDisconnected", onDisconnected, false);
    background.addEventListener("WeaveSyncSyncBegin", onSyncBegin, false);
    background.addEventListener("WeaveSyncSyncEnd", onSyncEnd, false);

    // Make sure the UI reflects what the client is doing at the moment.
    switch (Weave.Chromium.status) {
    case "disconnected":
        onDisconnected();
        break;
    case "connecting":
        onConnecting();
        break;
    case "connected":
        onConnected();
        break;
    case "syncing":
        onSyncBegin();
        break;
    }
    updateSyncTime();
}

// Open a page within this extension
function openPage (page) {
    page = chrome.extension.getURL(page);
    return function () {
        window.close();
        chrome.tabs.create({url: page});
    };
}

// Handler that swallows click events if the menu item is disabled
function onItemClick (handler) {
    return function () {
        if (this.getAttribute("disabled") === "disabled") {
            return;
        }
        handler();
    }
}


// Event handlers when buttons are pressed

function onConnectButton () {
    switch (Weave.Chromium.status) {
    case "disconnected":
        Weave.Chromium.connect();
        return;
    case "connected":
        Weave.Chromium.disconnect();
        return;
    default:
        // Shouldn't get here, but you never know
        return;
    }
}

function onSyncButton () {
    if (Weave.Chromium.status !== "connected") {
        return;
    }
    Weave.Chromium.sync();
}

// Helper functions
function updateSyncTime () {
    if (localStorage["lastSync"] !== null) {
        date = new Date(localStorage["lastSync"]);
        jQuery('time').text(this.days[date.getDay()] + " " + date.getHours() + ":" + date.getMinutes());
    } else {
        jQuery('time').text("never");
    }
}

// Event handlers for updating the UI when Weave.Chromium does something

function onConnecting () {
    var button = jQuery('#connect-button');
    button.attr('disabled', 'disabled');
    button.text('Connecting...');
}

function onConnected () {
    var button = jQuery('#connect-button');
    button.removeAttr('disabled');
    button.text('Disconnect');
    jQuery('#sync-button').removeAttr('disabled');
}

function onDisconnected () {
    var button = jQuery('#connect-button');
    button.removeAttr('disabled');
    button.text('Connect');
    jQuery('#sync-button').attr('disabled', 'disabled');
}

function onSyncBegin () {
    var button = jQuery('#sync-button');
    button.attr('disabled', 'disabled');
    button.text('Syncing...');
    jQuery('#connect-button').attr('disabled', 'disabled');
}

function onSyncEnd () {
    var button = jQuery('#sync-button');
    button.removeAttr('disabled');
    button.text('Sync now');
    jQuery('#sync-button').removeAttr('disabled');
    jQuery('#connect-button').removeAttr('disabled');
    updateSyncTime();
}

document.addEventListener('DOMContentLoaded', function () {
  onLoad();
});