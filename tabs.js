var background = chrome.extension.getBackgroundPage();
var Weave = background.Weave;

function onLoad() {
    var node;
    var wbos = Weave.Chromium.Tabs.wbos;
    for (var id in wbos) {
        if (!wbos[id].tabs || !wbos[id].tabs.length) {
            continue;
        }

        node = jQuery('#client-template').clone();
        node.attr('id', 'client-' + id);
        node.find('h2').text(wbos[id].clientName);
        var list = node.find('.tabs');

        wbos[id].tabs.forEach(function (tab) {
            var tabnode = jQuery('#tab-template').clone();
            tabnode.removeAttr('id');
            tabnode.find('img').attr('src', tab.icon);
            var url = tab.urlHistory[tab.urlHistory.length-1];
            tabnode.find('a').attr('href', url).text(tab.title || url);
            tabnode.appendTo(list);
        });

        node.appendTo('#clients');
    }
}

document.addEventListener('DOMContentLoaded', function () {
  onLoad();
});