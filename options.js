var background = chrome.extension.getBackgroundPage();
var Weave = background.Weave;
var options = Weave.Chromium.options;

function fillFormFields () {
    // Initialize form fields with stored values
    var optionElementIds = ["server", "user", "password", "passphrase"];
    optionElementIds.forEach(function (id) {
        var input = document.getElementById(id);
        if (options[id]) {
            input.value = options[id];
        } else {
            input.value = '';
        }
        input.addEventListener("blur", onInputBlur, "blurred");
    });
    jQuery('#clientGUID').text(options.client.id);
}

function onLoad () {
    fillFormFields();

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

function onResetButton () {
    if (Weave.Chromium.status !== "disconnected") {
        return;
    }
    Weave.Chromium.reset();
    options = Weave.Chromium.options;
    fillFormFields();
}

function onClearCacheButton () {
    Weave.Chromium.clearCache();
    options = Weave.Chromium.options;
    fillFormFields();
}

function onSyncButton () {
    if (Weave.Chromium.status !== "connected") {
        return;
    }
    Weave.Chromium.sync();
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
    button.text('Sync');
    jQuery('#sync-button').removeAttr('disabled');
    jQuery('#connect-button').removeAttr('disabled');
}

function onInputBlur (event) {
    if (Weave.Chromium.status !== "disconnected") {
        return;
    }
    options[event.target.id] = event.target.value;
    //XXX is this a good idea? we could be syncing atm...
    Weave.Chromium.saveOptions();
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('button#connect-button').addEventListener('click', onConnectButton);
  document.querySelector('button#reset-button').addEventListener('click', onResetButton);
  document.querySelector('button#clear-button').addEventListener('click', onClearCacheButton);
  document.querySelector('button#sync-button').addEventListener('click', onSyncButton);
  onLoad();
});