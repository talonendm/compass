


var coordList;
var myIcon;
var locationButton;
var map;

function preload() {
    // var url = "https://api.openbrewerydb.org/breweries?by_city=san_diego&per_page=50"
    // https://api.openbrewerydb.org/breweries?by_city=chicago
    
    var url = "data/coordinates.json"
    
  
    loadJSON(url, gotData);

}

function gotData(data) {
    coordList = data;
  }




// Flag to keep track of whether location is enabled
var locationEnabled = false;

// Function to handle a click on the location button
function toggleLocation() {
  if (locationEnabled) {
    // Disable location and update the button text
    locationEnabled = false;
    locationButton.html('Enable Location');
  } else {
    // Enable location and update the button text
    locationEnabled = true;
    locationButton.html('Disable Location');

    // Get the current position and log it to the console
    getCurrentPosition(function(position) {
      console.log(position);
    });
  }
}




function setup() {
    // create the canvas for the map
    //var canvas = createCanvas(800, 600);

// Create a full-screen canvas
var canvas = createCanvas(windowWidth, windowHeight);

    canvas.parent('map');
  
    // see package: https://leafletjs.com/download.html
    // The latitude of Helsinki, Finland is 60.192059, and the longitude is 24.945831.

    // create the Leaflet map
    map = L.map('map').setView([60.192059, 24.945831], 13);
    //L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //  attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    //  maxZoom: 18
    //}).addTo(map);

// Create a button to enable/disable location
locationButton = createButton('Enable Location');
locationButton.position(10, 10);
// Attach the toggleLocation function as a callback for the button
locationButton.mousePressed(toggleLocation);


    // Get the user's GPS location
navigator.geolocation.getCurrentPosition(
    // Success callback
    function(position) {
        // Get the latitude and longitude from the Position object
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;

        // Add a marker to the map at the user's location
        // L.marker([lat, lng]).addTo(mymap);
        L.marker([lat, lng]).addTo(map);
    },
    // Error callback
    function(error) {
        console.log('Error getting GPS location: ' + error.message);
    }
);





    myIcon = L.icon({
        iconUrl: 'data/s1.png',
        iconSize:     [37], // size of the icon
        iconAnchor:   [20, 59], // point of the icon which will correspond to marker's location
        popupAnchor:  [-12, -56] // point from which the popup should open relative to the iconAnchor
      });


    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);


    
// https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png


    // map.setView([51.505, -0.09], 13);




     // toimii L.marker([60.1920, 24.9458], {icon: myIcon}).addTo(map).bindPopup("testi");

       
  for (i = 0; i < coordList.length; i++) {
    lat = coordList[i].latitude;
    long = coordList[i].longitude;
    name = coordList[i].name;
    web = coordList[i].website_url;
    print(lat, long);
    print(web);
    
    if (long != null) {
     L.marker([lat, long], {icon: myIcon}).addTo(map).bindPopup(name  + '<br>' + web);
    }
  }

  }
  
  function draw() {
    // update the map
    // ...
    // background(200);

    //fill(100,0,0);
    //ellipse(30,30,40,40);

    // p5: https://editor.p5js.org/haques/sketches/5kH03sdnC ... kopio - katso vinkkeja
     
    // drawEllipse();

   


  }






  function drawEllipse() {
    // draw an animated ellipse on the map
    var x = random(width);
    var y = random(height);
    ellipse(x,y,10,10); // menee taustalla.. eli voisi olla erillinen kanvas kartan alapuolella

  }