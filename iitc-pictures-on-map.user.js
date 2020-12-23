// ==UserScript==
// @author      sanshine, Eccenux
// @name        IITC plugin: Pictures on the map
// @id          portal-pictures-on-map
// @category    Layer
// @namespace   pl.enux.iitc
// @version     0.2.0
// @description [0.2.0] Show portal pictures on the map + expand the Portals List table + improve the portal picture dialog
// @match       https://*.ingress.com/intel*
// @match       http://*.ingress.com/intel*
// @grant       none
// @updateURL   https://github.com/Eccenux/IITC-Pictures-On-Map/raw/main/iitc-pictures-on-map.meta.js
// @downloadURL https://github.com/Eccenux/IITC-Pictures-On-Map/raw/main/iitc-pictures-on-map.user.js
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};


// use own namespace for plugin
window.plugin.portalPicturesOnMap = function() {};

window.plugin.portalPicturesOnMap.PICTURE_WIDTH = 60;

window.plugin.portalPicturesOnMap.labelLayers = {};
window.plugin.portalPicturesOnMap.labelLayerGroup = null;

/**
 * Remove image marker from the map.
 */
window.plugin.portalPicturesOnMap.removeLabel = function(guid) {
  var previousLayer = window.plugin.portalPicturesOnMap.labelLayers[guid];
  if(previousLayer) {
    window.plugin.portalPicturesOnMap.labelLayerGroup.removeLayer(previousLayer);
    delete plugin.portalPicturesOnMap.labelLayers[guid];
  }
}

/**
 * Add image marker on the map.
 */
window.plugin.portalPicturesOnMap.addLabel = function(guid, latLng) {
  var previousLayer = window.plugin.portalPicturesOnMap.labelLayers[guid];
  if (!previousLayer) {

    var d = window.portals[guid].options.data;
    var portalPicture = d.image;

    var label = L.marker(latLng, {
      icon: L.divIcon({
        className: 'plugin-portal-pictures',
        iconAnchor: [window.plugin.portalPicturesOnMap.PICTURE_WIDTH/2,0],
        // note that height will just be height of enclosing div, must be small for wide images
        // note that image will overflow the div and will be clickable anyway (with too high div the div would be clickable but img would not fill the height)
        iconSize: [window.plugin.portalPicturesOnMap.PICTURE_WIDTH,window.plugin.portalPicturesOnMap.PICTURE_WIDTH/3],
        html: "<img src = \"" + portalPicture + "\" width=100%>"
      }),
      guid: guid,
      interactive: false
    });
    window.plugin.portalPicturesOnMap.labelLayers[guid] = label;
    label.on('click', function() { renderPortalDetails(guid); });
    label.addTo(window.plugin.portalPicturesOnMap.labelLayerGroup);
  }
}

window.plugin.portalPicturesOnMap.clearAllPortalLabels = function() {
  for (var guid in window.plugin.portalPicturesOnMap.labelLayers) {
    window.plugin.portalPicturesOnMap.removeLabel(guid);
  }
}


window.plugin.portalPicturesOnMap.updatePortalLabels = function() {
  // as this is called every time layers are toggled, there's no point in doing it when the layer is off
  if (!map.hasLayer(window.plugin.portalPicturesOnMap.labelLayerGroup)) {
    return;
  }

  var portalPoints = {};

  for (let guid in window.portals) {
    var p = window.portals[guid];
    if (p._map && p.options.data.image) {  // only consider portals added to the map and with an image
      var point = map.project(p.getLatLng());
      portalPoints[guid] = point;
    }
  }

  // remove any not wanted
  for (let guid in window.plugin.portalPicturesOnMap.labelLayers) {
    if (!(guid in portalPoints)) {
      window.plugin.portalPicturesOnMap.removeLabel(guid);
    }
  }

  // and add those we do
  for (let guid in portalPoints) {
    window.plugin.portalPicturesOnMap.addLabel(guid, portals[guid].getLatLng());
  }
}

// as calculating portal marker visibility can take some time when there's lots of portals shown, we'll do it on
// a short timer. this way it doesn't get repeated so much
window.plugin.portalPicturesOnMap.delayedUpdatePortalLabels = function(wait) {

  if (window.plugin.portalPicturesOnMap.timer === undefined) {
    window.plugin.portalPicturesOnMap.timer = setTimeout ( function() {
      window.plugin.portalPicturesOnMap.timer = undefined;
      window.plugin.portalPicturesOnMap.updatePortalLabels();
    }, wait*1000);

  }
}

// replacement for portallist dialog open
// this just changes default sort
function displayPL() {
  var list;
  // plugins (e.g. bookmarks) can insert fields before the standard ones - so we need to search for the 'level' column
  window.plugin.portalslist.sortBy = window.plugin.portalslist.fields.map(function(f){return f.title;}).indexOf('Portal Name');
  window.plugin.portalslist.sortOrder = -1;
  window.plugin.portalslist.enlP = 0;
  window.plugin.portalslist.resP = 0;
  window.plugin.portalslist.neuP = 0;
  window.plugin.portalslist.filter = 0;

  if (window.plugin.portalslist.getPortals()) {
    list = window.plugin.portalslist.portalTable(window.plugin.portalslist.sortBy, window.plugin.portalslist.sortOrder,window.plugin.portalslist.filter);
  } else {
    list = $('<table class="noPortals"><tr><td>Nothing to show!</td></tr></table>');
  };

  if(window.useAndroidPanes()) {
    $('<div id="portalslist" class="mobile">').append(list).appendTo(document.body);
  } else {
    dialog({
      html: $('<div id="portalslist">').append(list),
      dialogClass: 'ui-dialog-portalslist',
      title: 'Portal list: ' + window.plugin.portalslist.listPortals.length + ' ' + (window.plugin.portalslist.listPortals.length == 1 ? 'portal' : 'portals'),
      id: 'portal-list',
      width: 700,
    });
  }
}


var setup = function() {

    window.plugin.portalPicturesOnMap.labelLayerGroup = new L.LayerGroup();
    window.addLayerGroup('Portal Pictures On Map', window.plugin.portalPicturesOnMap.labelLayerGroup, true);

    window.addHook('requestFinished', function() { setTimeout(function(){window.plugin.portalPicturesOnMap.delayedUpdatePortalLabels(3.0);},1); });
    window.addHook('mapDataRefreshEnd', function() { window.plugin.portalPicturesOnMap.delayedUpdatePortalLabels(0.5); });
    window.map.on('overlayadd overlayremove', function() { setTimeout(function(){window.plugin.portalPicturesOnMap.delayedUpdatePortalLabels(1.0);},1); });
    window.map.on('zoomend', window.plugin.portalPicturesOnMap.clearAllPortalLabels );

    //overwrite the default IITC portal image dialog with one that can pop up the full size portal picture
    window.setupLargeImagePreviewOverwrite = function () {
        $('#portaldetails').off('click', '.imgpreview')
        $('#portaldetails').on('click', '.imgpreview', function (e) {
            var img = this.querySelector('img');
            //dialogs have 12px padding around the content
            var dlgWidth = Math.max(img.naturalWidth+24,500);

            var preview = new Image(img.width, img.height);
            preview.src = img.src;
            preview.style = 'margin: auto; display: block';

            var picturelink = document.createElement('a');
            picturelink.setAttribute('href', img.src + '=s0');
            picturelink.setAttribute('target', '_blank');
            picturelink.appendChild(preview);

            var title = e.delegateTarget.querySelector('.title').innerText;
            dialog({
                html: picturelink,
                title: title,
                id: 'iitc-portal-image',
                width: dlgWidth,
            });
        });
    }
    window.setupLargeImagePreviewOverwrite();

    //if the "Portals List" plugin is installed, insert an extra column with the portal photos
    if (window.plugin.portalslist) {
        let item = {
            title: "Portal Picture",
            value: function(portal) { return portal.options.data.image; },
            format: function(cell, portal, value) {
                $(cell)
                    .append("<img src=\"" + value + "\" width=100%>");
            }
        }
        // insert picture item
        window.plugin.portalslist.fields.splice(1, 0, item);

        // replace displayPL impl
        window.plugin.portalslist.displayPL = displayPL;

        // remove some items (to make the image wider)
        let fields = window.plugin.portalslist.fields
        let removeMe = ['Team', 'Health', 'Links', 'Fields', 'AP']
        for (let i=0; i<removeMe.length; i++) {
            let title = removeMe[i];
            let index = fields.map(f=>f.title).indexOf(title);
            fields.splice(index, 1);
        }
    }

}

setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description, priority: 'normal' };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);

