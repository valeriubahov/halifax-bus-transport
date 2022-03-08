//Set the coord for the initial view of the map, zoom 14 (higher value - higher zoom)
let map = L.map('busMap').setView([44.6488, -63.5752], 14);

let originalPosition = [];
let originalPlane = [];
let geoJson = { "type": "FeatureCollection", "features": [] };
let geoJsonPlane = { "type": "FeatureCollection", "features": [] };
let geoJSONLayer;
let geoJSONFlightsLayer;
let isPlaneRefresh = false;
let isBusRefresh = true;
let planeInterval;
let busNumber;
let busFilterInterval = false;
let isFilterRefresh = false;
let busInterval;

//Display tile layer on the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


// BUS ICON
const busIconSmall = L.icon({
    iconUrl: 'images/bus.png',
    iconSize: [25, 25], //small
    popupAnchor: [0, -10]
});

const busIconBig = L.icon({
    iconUrl: 'images/bus.png',
    iconSize: [45, 45], // big
    popupAnchor: [0, -10]
});

// PLANE ICON
const planeIconSmall = L.icon({
    iconUrl: 'images/plane.png',
    iconSize: [15, 15], // small
    popupAnchor: [0, -10]
});

const planeIconNormal = L.icon({
    iconUrl: 'images/plane.png',
    iconSize: [30, 30], // big
    popupAnchor: [0, -10]
});


//EVENT handler for searching fields
document.getElementById("findBus").addEventListener('click', findBus);
document.getElementById("clear").addEventListener('click', update_position);

//Event handler for the bus view button
document.getElementById('cityView').addEventListener('click', resetView);

//Function called after you press the "Bus View" button
function resetView() {
    map.setView([44.6488, -63.5752], 14);
}

//Draw the markers for the first time on the map
fetchBus();


//Update the positions every 7 sec
busInterval = setInterval(update_position, 7000);
isBusRefresh = true;


// Draw the markers on the map for the first time
function fetchBus() {
    //This controll is used only if the initial fetch method is called, it checks if there is an actual Interval on displaying the busses
    //if there is it clear the layer, and remove the interval
    if (isFilterRefresh) {
        clearInterval(busFilterInterval);
        geoJSONLayer.clearLayers();
        isFilterRefresh = false;
    }
    fetch('http://hrmbusapi.herokuapp.com/').then(json => json.json())
        .then(json => {
            // Filter all Buses from 1 to 10 (include the buses that have letters too)
            const rawData = json.entity.filter(x => x.vehicle.trip.routeId <= 10
                || (x.vehicle.trip.routeId == '6A'
                    || x.vehicle.trip.routeId == '6B'
                    || x.vehicle.trip.routeId == '6C'
                    || x.vehicle.trip.routeId == '7A'
                    || x.vehicle.trip.routeId == '7B'
                    || x.vehicle.trip.routeId == '9A'
                    || x.vehicle.trip.routeId == '9B')
            );
            console.log("RAW TRANSIT DATA RETRIEVAL", json.entity);
            console.log("FILTERED TRANSIT DATA RETRIEVAL", rawData);

            // Create an Object that will be used to generate the GeoJSON
            originalPosition = rawData.map(x => {
                const newObj = {};
                newObj.latLng = [x.vehicle.position.longitude, x.vehicle.position.latitude];
                newObj.routeId = x.vehicle.trip.routeId;
                newObj.id = x.vehicle.vehicle.id;
                newObj.bearing = x.vehicle.position.bearing;
                newObj.occupancy = x.vehicle.occupancyStatus;
                return (newObj);
            });
        })
        .then(x => {
            //Transform the previously fetched JSON into GeoJSON
            geoJSONLayer = L.geoJSON(getData(), {
                onEachFeature: onEachFeature,
                pointToLayer: function (feature, latlng) {
                    // Check the Map Zoom level and decide what icon size to draw
                    let currentZoom = map.getZoom();
                    if (currentZoom > 15) {
                        return L.marker(latlng, { icon: busIconBig, rotationAngle: feature.properties.bearing }).addTo(map);
                    }
                    else {
                        if (currentZoom <= 10) {
                            geoJSONLayer.clearLayers();
                        }
                        else {
                            return L.marker(latlng, { icon: busIconSmall, rotationAngle: feature.properties.bearing }).addTo(map);
                        }
                    }
                }
            }).addTo(map);
            if (!isBusRefresh) {
                busInterval = setInterval(update_position, 7000);
                isBusRefresh = true;
            }
        });
}


// Update the marker position on map without reloading the page
function update_position() {

    //If the user used the filter before ans switched to standard view, this part will clear all the datas to display all buses
    if (isFilterRefresh) {
        busNumber = undefined;
        document.getElementById('busNumber').value = '';
        clearInterval(busFilterInterval);
        geoJSONLayer.clearLayers();
        isFilterRefresh = false;
    }

    fetch('http://hrmbusapi.herokuapp.com/').then(json => json.json())
        .then(json => {
            // Filter all Buses from 1 to 10 (include the buses that have letters too)
            originalPosition = json.entity.filter(x => x.vehicle.trip.routeId <= 10
                || (x.vehicle.trip.routeId == '6A'
                    || x.vehicle.trip.routeId == '6B'
                    || x.vehicle.trip.routeId == '6C'
                    || x.vehicle.trip.routeId == '7A'
                    || x.vehicle.trip.routeId == '7B'
                    || x.vehicle.trip.routeId == '9A'
                    || x.vehicle.trip.routeId == '9B')).map(x => {
                        const newObj = {};
                        newObj.latLng = [x.vehicle.position.longitude, x.vehicle.position.latitude];
                        newObj.routeId = x.vehicle.trip.routeId;
                        newObj.id = x.vehicle.vehicle.id;
                        newObj.bearing = x.vehicle.position.bearing;
                        newObj.occupancy = x.vehicle.occupancyStatus;
                        return (newObj);
                    });
            geoJson = getData();
            console.log("----> [UPDATE] - BUSES POSITION - GeoJSON", geoJson);

            geoJSONLayer.clearLayers();
            geoJSONLayer.addData(geoJson);

            //If the interval to refresh akk buses position is not set, this will set the interval again
            if (!isBusRefresh) {
                busInterval = setInterval(update_position, 7000);
                isBusRefresh = true;
            }
        });
}


//Find the busses from the input field by routeId
function findBus(event) {
    //Clear all layers to display only the searched bus
    geoJSONLayer.clearLayers();
    clearInterval(busInterval);
    isBusRefresh = false;

    busNumber = document.getElementById('busNumber').value;

    fetch('http://hrmbusapi.herokuapp.com/').then(json => json.json())
        .then(json => {
            // Filter all Buses from 1 to 10 (include the buses that have letters too)
            const rawData = json.entity.filter(x => x.vehicle.trip.routeId === busNumber);
            console.log("BUS N.", busNumber, "TRANSIT DATA RETRIEVAL", rawData);

            // Create an Object that will be used to generate the GeoJSON
            originalPosition = rawData.map(x => {
                const newObj = {};
                newObj.latLng = [x.vehicle.position.longitude, x.vehicle.position.latitude];
                newObj.routeId = x.vehicle.trip.routeId;
                newObj.id = x.vehicle.vehicle.id;
                newObj.bearing = x.vehicle.position.bearing;
                newObj.occupancy = x.vehicle.occupancyStatus;
                return (newObj);
            });
        })
        .then(x => {
            //Transform the previously fetched JSON into GeoJSON
            geoJSONLayer = L.geoJSON(getData(), {
                onEachFeature: onEachFeature,
                pointToLayer: function (feature, latlng) {
                    // Check the Map Zoom level and decide what icon size to draw
                    let currentZoom = map.getZoom();
                    if (currentZoom > 15) {
                        return L.marker(latlng, { icon: busIconBig, rotationAngle: feature.properties.bearing }).addTo(map);
                    }
                    else {
                        if (currentZoom <= 10) {
                            geoJSONLayer.clearLayers();
                        }
                        else {
                            return L.marker(latlng, { icon: busIconSmall, rotationAngle: feature.properties.bearing }).addTo(map);
                        }
                    }
                }
            }).addTo(map);

            if (!isFilterRefresh) {
                busFilterInterval = setInterval(update_filtered_position, 7000);
                isFilterRefresh = true;
            }
        });

}


//This method will update only the position of the filtered bus
function update_filtered_position() {

    fetch('http://hrmbusapi.herokuapp.com/').then(json => json.json())
        .then(json => {
            originalPosition = json.entity.filter(x => x.vehicle.trip.routeId === busNumber).map(x => {
                const newObj = {};
                newObj.latLng = [x.vehicle.position.longitude, x.vehicle.position.latitude];
                newObj.routeId = x.vehicle.trip.routeId;
                newObj.id = x.vehicle.vehicle.id;
                newObj.bearing = x.vehicle.position.bearing;
                newObj.occupancy = x.vehicle.occupancyStatus;
                return (newObj);
            });
            geoJson = getData();
            console.log("----> [UPDATE] - BUS N.", busNumber, "POSITION - GeoJSON", geoJson);
            geoJSONLayer.clearLayers();
            geoJSONLayer.addData(geoJson);
        });
}


//This method will show on the map all the planes having origin in Canada
function fetchPlanes() {
    fetch('https://opensky-network.org/api/states/all').then(json => json.json())
        .then(json => {
            const rawData = json.states.filter(x => x[2] === 'Canada');
            console.log("RAW PLANES FROM CANADA DATA RETRIEVAL", json.states);
            console.log("FILTERED PLANES FROM CANADA DATA RETRIEVAL", rawData);

            originalPlane = rawData.map(x => {
                const newObj = {};
                newObj.latLng = [x[5], x[6]];
                newObj.routeId = x[1];
                newObj.id = x[0];
                newObj.bearing = x[10];
                return (newObj);
            });
        })
        .then(x => {
            //Transform the previously fetched JSON into GeoJSON
            geoJSONFlightsLayer = L.geoJSON(getPlaneData(), {
                onEachFeature: onEachPlane,
                pointToLayer: function (feature, latlng) {
                    // Check the Map Zoom level and decide what icon size to draw
                    let currentZoom = map.getZoom();
                    if (currentZoom > 11) {
                        if (geoJSONFlightsLayer !== undefined) {
                            geoJSONFlightsLayer.clearLayers();
                        }
                    }
                    else {
                        if (currentZoom > 5) {
                            return L.marker(latlng, { icon: planeIconNormal, rotationAngle: feature.properties.bearing }).addTo(map);
                        }
                        else {
                            return L.marker(latlng, { icon: planeIconSmall, rotationAngle: feature.properties.bearing }).addTo(map);

                        }
                    }
                }
            }).addTo(map);
        });
}


//This method will update the position of planes on the map
function updatePlanePosition() {

    fetch('https://opensky-network.org/api/states/all').then(json => json.json())
        .then(json => {
            const rawData = json.states.filter(x => x[2] === 'Canada');
            originalPlane = rawData.map(x => {
                const newObj = {};
                newObj.latLng = [x[5], x[6]];
                newObj.routeId = x[1];
                newObj.id = x[0];
                newObj.bearing = x[10];
                return (newObj);
            });
        });
    geoJsonPlane = getPlaneData();
    console.log("----> [UPDATE] - PLANES POSITION - GeoJSON -", geoJsonPlane);
    geoJSONFlightsLayer.clearLayers();
    geoJSONFlightsLayer.addData(geoJsonPlane);
}


// ADD the popup for every icon with bus number and occupancy status
function onEachFeature(feature, layer) {
    if (feature.properties && feature.properties.routeId) {
        layer.bindPopup("<b>Bus Number: " + feature.properties.routeId + " </br>Occupancy Status: " + ((feature.properties.occupancy !== undefined) ? feature.properties.occupancy.replaceAll("_", " ") : 'Unknown') + "</b>");
    }
}


//For each plane i create a popup
function onEachPlane(feature, layer) {
    if (feature.properties && feature.properties.routeId) {
        layer.bindPopup("<b>Plane Number: " + feature.properties.routeId + "</b>");
    }
}


// Bus GeoJSON
function getData() {
    geoJson.features = [];
    originalPosition.map(x => {
        let coordinate = x.latLng;
        let properties = x;
        let feature = { "type": "Feature", "geometry": { "type": "Point", "coordinates": coordinate }, "properties": properties };
        geoJson.features.push(feature);
    });
    return geoJson;
}


//Planes GeoJSON
function getPlaneData() {
    geoJsonPlane.features = [];
    originalPlane.map(x => {
        let coordinate = x.latLng;
        let properties = x;
        let feature = { "type": "Feature", "geometry": { "type": "Point", "coordinates": coordinate }, "properties": properties };
        geoJsonPlane.features.push(feature);
    });
    return geoJsonPlane;
}


// On map zoom I change the view from busses to planes
map.on('zoomend', function () {
    let currentZoom = map.getZoom();
    if (currentZoom > 15) {
        geoJSONLayer.eachLayer(function (layer) {
            return layer.setIcon(busIconBig);
        });
    } else {
        if (currentZoom <= 11) {
            document.getElementById("filter").style.display = 'none';
            document.getElementById("planeButtons").style.display = 'block';
            if (!isPlaneRefresh) {
                geoJSONLayer.clearLayers();
                if (isBusRefresh) {
                    clearInterval(busInterval);
                    isBusRefresh = false;
                }
                else if (isFilterRefresh) {
                    clearInterval(busFilterInterval);
                    isFilterRefresh = false;
                }
                fetchPlanes();
                planeInterval = setInterval(updatePlanePosition, 7000);
                isPlaneRefresh = true;
            }
            if (geoJSONFlightsLayer !== undefined) {
                if (currentZoom <= 5) {
                    geoJSONFlightsLayer.eachLayer(function (layer) {
                        return layer.setIcon(planeIconSmall);
                    });
                }
                else {
                    geoJSONFlightsLayer.eachLayer(function (layer) {
                        return layer.setIcon(planeIconNormal);
                    });
                }
            }
        }
        else {
            if (geoJSONFlightsLayer !== undefined) {
                if (document.getElementById("filter").style.display === 'none') {
                    document.getElementById("filter").style.display = 'block';
                    document.getElementById("planeButtons").style.display = 'none';

                }
                if (!isBusRefresh && busNumber === undefined) {
                    geoJSONFlightsLayer.clearLayers();
                    clearInterval(planeInterval);
                    fetchBus();
                    busInterval = setInterval(update_position, 7000);
                    isBusRefresh = true;
                    isPlaneRefresh = false;
                }
                else if (!isFilterRefresh && busNumber !== undefined) {
                    geoJSONFlightsLayer.clearLayers();
                    clearInterval(planeInterval);
                    findBus();
                    busFilterInterval = setInterval(update_filtered_position, 7000);
                    isFilterRefresh = true;
                    isPlaneRefresh = false;
                }
            }
        }
        geoJSONLayer.eachLayer(function (layer) {
            return layer.setIcon(busIconSmall);
        });
    }
});