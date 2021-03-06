/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */

/*trying to go with the triangles route*/
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json"; // ellipsoids file loc
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(2,4,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene

var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var textureBuffers = []; // this contains texture component lists by set, in doubles
var newTextureArray = [];
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var aplhaULoc; // where to put alpha component for texture transparency
var mode = {}; //changing how to render texture lightning

var images =[]; 
var models =[]; // setting all the models in this for sorting
var textureLocation;
var imagesToLoad;

const modelEnum = {TRIANGLES: "triangles", ELLIPSOID: "ellipsoid"}; // enumerated model type

// var vNormAttribLoc;
 /* Shader texture locations */
 var texPosArrtibLoc; // where to put position of texture for vertex shader
 

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {
    
   
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    function highlightModel(modelType,whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel]; 
        else
            handleKeyDown.modelOn = inputEllipsoids[whichModel]; 
        handleKeyDown.modelOn.on = true; 
    } // end highlight model
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    
    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    var flagEventTriggered = false
    function toggleFlag(){flagEventTriggered = true}

    switch (event.code) {
        
        // model selection
        case "Space": 
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
            toggleFlag()
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn+1) % numTriangleSets);
            toggleFlag()
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numTriangleSets-1);
            toggleFlag()
            break;
        case "ArrowUp": // select next ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn+1) % numEllipsoids);
            toggleFlag()
            break;
        case "ArrowDown": // select previous ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numEllipsoids-1);
            toggleFlag()
            break;
            
        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            toggleFlag()
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            toggleFlag()
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            toggleFlag()
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            toggleFlag()
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,-viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
            } // end if shift not pressed
            toggleFlag()
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
            } // end if shift not pressed
            toggleFlag()
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            toggleFlag()
            break;
            
        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,viewRight,viewDelta));
            toggleFlag()
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,viewRight,-viewDelta));
            toggleFlag()
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,lookAt,-viewDelta));
            toggleFlag()
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,lookAt,viewDelta));
            toggleFlag()
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,Up,viewDelta));
            toggleFlag()
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,Up,-viewDelta));
            toggleFlag()
            break;
        case "KeyB": // translate down, rotate clockwise with shift
            mode.value = (mode.value+1)%3
            gl.uniform1f(mode.location,mode.value);
            toggleFlag()
           break;


        case "Backspace": // reset model transforms to default
            for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation,0,0,0);
                vec3.set(inputTriangles[whichTriSet].xAxis,1,0,0);
                vec3.set(inputTriangles[whichTriSet].yAxis,0,1,0);
            } // end for all triangle sets
            for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                vec3.set(inputEllipsoids[whichEllipsoid].translation,0,0,0);
                vec3.set(inputEllipsoids[whichTriSet].xAxis,1,0,0);
                vec3.set(inputEllipsoids[whichTriSet].yAxis,0,1,0);
            } // end for all ellipsoids
            toggleFlag()
            break;

          
    } // end switch
    if(flagEventTriggered)
    {
      sortModelsByDepth();
      renderModels();
    }
} // end handleKeyDown

function setDistanceFromEye(model)
{
    var temp = vec3.create();
    var tempCenter = vec3.create();

  var distVect = vec3.subtract(temp,Eye,vec3.add(tempCenter,model.center,model.translation));
  model.distance = vec3.dot(distVect,distVect)    

}


function sortModelsByDepth(){

//console.log("sorting model by depth")
models.forEach(function(model){
    setDistanceFromEye(model)
//console.log(model.name+" "+model.alpha+" "+model.distance)

});
models.sort(function(model1,model2)
 {
     if(model1.alpha == 1 &&  model2.alpha == 1)
        return model2.distance - model1.distance
    //we need to ensure that models with alpha 1 needs to stay in the front of models
    if(model1.alpha == 1)
        return -1;
    if(model2.alpha == 1)
        return 1;
    // sort in descending order of Depth
    return model2.distance - model1.distance


  });

writeDepthValues();

}

function writeDepthValues(){

models.forEach(function(model,index){
    //console.log(model.name+" "+model.distance)
var textbox = document.getElementById("box"+(index+1))
textbox.value = model.name
})

}

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

      // Get the image canvas, render an image in it
     var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height; 
      imageContext = imageCanvas.getContext("2d"); 
      var bkgdImage = new Image(); 
      bkgdImage.crossOrigin = "Anonymous";
      bkgdImage.src = "https://ncsucgclass.github.io/prog3/sky.jpg";
      bkgdImage.onload = function(){
          var iw = bkgdImage.width, ih = bkgdImage.height;
          imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
     } // end onload callback
    
     // create a webgl canvas and set it up
     var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
     gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
     try {
       if (gl == null) {
         throw "unable to create gl context -- is your browser gl ready?";
       } else {
         //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
         gl.clearDepth(1.0); // use max when we clear the depth buffer
         gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
       }
     } // end try
     
     catch(e) {
       console.log(e);
     } // end catch
} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {

    // make an ellipsoid, with numLongSteps longitudes.
    // start with a sphere of radius 1 at origin
    // Returns verts, tris and normals.
    function makeEllipsoid(currEllipsoid,numLongSteps) {

        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps
                // make vertices
                var ellipsoidVerticesOrig = [0,-1,0]; // vertices to return, init to south pole
                var angleIncr = (Math.PI+Math.PI) / numLongSteps; // angular increment 
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps/4)-1); // start/end lat angle
                var latRadius, latY; // radius and Y at current latitude
                var textureVertices = [0,0];
               // console.log("lat limit angle",latLimitAngle)
                 //  console.log("lat  angle",angleIncr)
                for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle; latAngle+=angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude                     
                     for (var longAngle=0; longAngle<2*Math.PI+angleIncr; longAngle+=angleIncr) // for each long
                    {
                        ellipsoidVerticesOrig.push(latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));

                    }

                } // end for each latitude

                ellipsoidVerticesOrig.push(0,1,0);// add north pole

                var ellipsoidVertices = ellipsoidVerticesOrig.slice();
                ellipsoidVertices = ellipsoidVertices.map(function(val,idx) { // position and scale ellipsoid
                    switch (idx % 3) {
                        case 0: // x
                            return(val*currEllipsoid.a+currEllipsoid.x);
                        case 1: // y
                            return(val*currEllipsoid.b+currEllipsoid.y);
                        case 2: // z
                            return(val*currEllipsoid.c+currEllipsoid.z);
                    } // end switch
                }); //end of ellipsoid vertices

                // make normals using the ellipsoid gradient equation
                // resulting normals are unnormalized: we rely on shaders to normalize
                var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
                ellipsoidNormals = ellipsoidNormals.map(function(val,idx) { // calculate each normal
                    switch (idx % 3) {
                        case 0: // x
                            return(2/(currEllipsoid.a*currEllipsoid.a) * (val-currEllipsoid.x));
                        case 1: // y
                            return(2/(currEllipsoid.b*currEllipsoid.b) * (val-currEllipsoid.y));
                        case 2: // z
                            return(2/(currEllipsoid.c*currEllipsoid.c) * (val-currEllipsoid.z));
                    } // end switch
                }); //end of ellipsoid normals                

           var textureVertices = [0,0];
                for (var latNum = 0; latNum <= numLongSteps * 2 ; latNum +=2) {
                    for (longNum = 0; longNum <= numLongSteps; longNum++)
                        textureVertices.push((longNum / numLongSteps),(latNum / numLongSteps));
                }
                textureVertices.push(textureVertices[textureVertices.length-2],textureVertices[textureVertices.length-1])

               // console.log(textureVertices)
/*
                   console.log("ellipsoidVertices.length " ,ellipsoidVertices.length) 
                   console.log("texVertices.length " ,textureVertices.length) 
                   console.log("ellipsoid to tex " ,ellipsoidVertices.length * 2 /3) 
*/


                // make triangles, from south pole to middle latitudes to north pole
                var ellipsoidTriangles = []; // triangles to return
                for (var whichLong=1; whichLong<numLongSteps; whichLong++) // south pole
                    ellipsoidTriangles.push(0,whichLong,whichLong+1);

                ellipsoidTriangles.push(0,numLongSteps,1); // longitude wrap tri

                var llVertex; // lower left vertex in the current quad
                for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps-1; whichLong++) {
                        llVertex = whichLat*numLongSteps + whichLong + 1;
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps,llVertex+numLongSteps+1);
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps+1,llVertex+1);
                    } // end for each longitude
                    ellipsoidTriangles.push(llVertex+1,llVertex+numLongSteps+1,llVertex+2);
                    ellipsoidTriangles.push(llVertex+1,llVertex+2,llVertex-numLongSteps+2);
                } // end for each latitude // for loop

                for (var whichLong=llVertex+2; whichLong<llVertex+numLongSteps+1; whichLong++) // north pole
                    ellipsoidTriangles.push(whichLong,ellipsoidVertices.length/3-1,whichLong+1);

                ellipsoidTriangles.push(ellipsoidVertices.length/3-2,ellipsoidVertices.length/3-1,
                                        ellipsoidVertices.length/3-numLongSteps-1); // longitude wrap
            } // end if good number longitude steps // else condition





            return({vertices:ellipsoidVertices, normals:ellipsoidNormals, triangles:ellipsoidTriangles, uvs : textureVertices});
        } // end try
        
        catch(e) {
            console.log(e);
        } // end catch
    } // end make ellipsoid
    
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
                var whichSetVert; // index of vertex in current triangle set
                var whichSetTri; // index of triangle in current triangle set
                var vtxToAdd; // vtx coords to add to the coord array
                var normToAdd; // vtx normal to add to the coord array
                var uvToAdd; // uv coords to add to the uv arry
                var triToAdd; // tri indices to add to the index array
                var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
                var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
            
                // process each triangle set to load webgl vertex and triangle buffers
                numTriangleSets = inputTriangles.length; // remember how many tri sets
                for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                    var model = inputTriangles[whichSet];
                    // for sorting by alpha
                    model.alpha = model.material.alpha
                    model.type = modelEnum.TRIANGLES
                    model.index = whichSet
                    model.name = model.type+" "+model.index

                    // set up hilighting, modeling translation and rotation
                    model.center = vec3.fromValues(0,0,0);  // center point of tri set
                    model.on = false; // not highlighted
                    model.translation = vec3.fromValues(0,0,0); // no translation
                    model.xAxis = vec3.fromValues(1,0,0); // model X axis
                    model.yAxis = vec3.fromValues(0,1,0); // model Y axis 

                    // set up the vertex and normal arrays, define model center and axes
                    model.glVertices = []; // flat coord list for webgl
                    model.glNormals = []; // flat normal list for webgl
                    model.glUvs = [];
                    var numVerts = model.vertices.length; // num vertices in tri set
                    for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                        vtxToAdd = model.vertices[whichSetVert]; // get vertex to add
                        normToAdd = model.normals[whichSetVert]; // get normal to add
                        uvToAdd = model.uvs[whichSetVert]; // get texture to add

                        model.glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                        model.glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                        model.glUvs.push(uvToAdd[0],uvToAdd[1]); // put texture in set coord list
                        
                        vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                        vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                        vec3.add(model.center,model.center,vtxToAdd); // add to ctr sum
                    } // end for vertices in set
                  //  console.log("UVS : ", model.glUvs)
                    vec3.scale(model.center,model.center,1/numVerts); // avg ctr sum

                    // send the vertex coords and normals to webGL
                    vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(model.glVertices),gl.STATIC_DRAW); // data in
                    normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(model.glNormals),gl.STATIC_DRAW); // data in
                    textureBuffers[whichSet] = gl.createBuffer(); // init empty webgl set Texture component buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[whichSet]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(model.glUvs),gl.STATIC_DRAW); // data in
                  //  console.log("triangle UVs : ",model.glUvs)
                    // set up the triangle index array, adjusting indices across sets
                    model.glTriangles = []; // flat index list for webgl
                    triSetSizes[whichSet] = model.triangles.length; // number of tris in this set
                    for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                        triToAdd = model.triangles[whichSetTri]; // get tri to add
                        model.glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                    } // end for triangles in set

                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(model.glTriangles),gl.STATIC_DRAW); // data in

                    models.push(model)
                } // end for each triangle set 

            } // end if triangle file loaded
        
            inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL,"ellipsoids"); // read in the ellipsoids

            if (inputEllipsoids == String.null)
                throw "Unable to load ellipsoids file!";
            else {
                
                // init ellipsoid highlighting, translation and rotation; update bbox
                var ellipsoid; // current ellipsoid
                var ellipsoidModel; // current ellipsoid triangular model
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                    
                    // set up various stats and transforms for this ellipsoid
                    var model = inputEllipsoids[whichEllipsoid];
                    model.type = modelEnum.ELLIPSOID
                    model.index = whichEllipsoid
                    model.name = model.type+" "+model.index

                    model.on = false; // ellipsoids begin without highlight
                    model.translation = vec3.fromValues(0,0,0); // ellipsoids begin without translation
                    model.xAxis = vec3.fromValues(1,0,0); // ellipsoid X axis
                    model.yAxis = vec3.fromValues(0,1,0); // ellipsoid Y axis 
                    model.center = vec3.fromValues(model.x,model.y,model.z); // locate ellipsoid ctr
                    vec3.set(minXYZ,model.x-model.a,model.y-model.b,model.z-model.c); 
                    vec3.set(maxXYZ,model.x+model.a,model.y+model.b,model.z+model.c); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(model,32);
    
                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.vertices),gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.normals),gl.STATIC_DRAW); // data in
                    textureBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[textureBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.uvs),gl.STATIC_DRAW); // data in
                   // console.log("ellipsoid UVs : ",ellipsoidModel.uvs)


                    triSetSizes.push(ellipsoidModel.triangles.length);
    
                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ellipsoidModel.triangles),gl.STATIC_DRAW); // data in
               
                    models.push(model)
                } // end for each ellipsoid
                
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
            } // end if ellipsoid file loaded

            

           // console.log(JSON.stringify(models))
        
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    sortModelsByDepth();
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aTexCoord; // texture position
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader 
        varying vec2 v_texcoord; // interpolated

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
            v_texcoord = aTexCoord;

        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        uniform float uAlpha;

        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment

        // Passed in from the vertex shader.
        varying vec2 v_texcoord;

        uniform float mode;

        // The texture.
        uniform sampler2D u_texture;
            
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
          //  gl_FragColor = vec4(colorOut, 1.0) * texture2D(u_texture, vec2(v_texcoord.s,v_texcoord.t)); 
            vec4 textureColor = texture2D(u_texture, v_texcoord); 
          if(mode==1.0)
          {
              gl_FragColor = vec4(textureColor.xyz,textureColor.a * uAlpha); 
            //gl_FragColor = vec4(colorOut, 1.0) * textureColor;  
            
          }
          else if(mode==2.0)
          {
             gl_FragColor = vec4(colorOut, 1.0) * vec4(textureColor.xyz,textureColor.a * uAlpha); 
            //gl_FragColor = vec4(colorOut, 1.0) * textureColor;  
            
          }
          else
          {
            //gl_FragColor = textureColor; 
             gl_FragColor = vec4(colorOut, uAlpha) + vec4(textureColor.xyz,textureColor.a * uAlpha); 
          }
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                texPosArrtibLoc = gl.getAttribLocation(shaderProgram, "aTexCoord");
                gl.enableVertexAttribArray(texPosArrtibLoc);


                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                textureLocation = gl.getUniformLocation(shaderProgram, "u_texture");
                //gl.uniform1i(textureLocation, 0);
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                aplhaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to shininess
                mode.location = gl.getUniformLocation(shaderProgram, "mode");
                mode.value = 1.0;
                
                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
                gl.uniform1f(mode.location,mode.value);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders




function setTexture(model){

gl.bindTexture(gl.TEXTURE_2D, model.textureObject);
gl.uniform1i(textureLocation, 0);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
// Set the parameters so we can render any size image.
// Fill the texture with a 1x1 blue pixel.
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));


model.image.src = model.textureUrl;
//console.log("https://ncsucgclass.github.io/prog3/"+imageSrc)
model.image.onload = function(){
  --imagesToLoad;
  model.image = this;
  gl.bindTexture(gl.TEXTURE_2D, model.textureObject);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, this);    
  if(imagesToLoad == 0)
  {
     renderModels();
  }
 // gl.generateMipmap(gl.TEXTURE_2D);  
 }

}


function setTextures(){

    imagesToLoad = numTriangleSets+numEllipsoids;


   
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        
        inputTriangles[whichTriSet].textureObject = gl.createTexture();
        inputTriangles[whichTriSet].textureUrl = "https://ncsucgclass.github.io/prog3/"+inputTriangles[whichTriSet].material.texture;

        var image = new Image();
        image.crossOrigin = "Anonymous";
        inputTriangles[whichTriSet].image = image;

        var model = inputTriangles[whichTriSet];
        setTexture(model);
    }

           
    for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {

        
        inputEllipsoids[whichEllipsoid].textureObject = gl.createTexture();
        inputEllipsoids[whichEllipsoid].textureUrl = "https://ncsucgclass.github.io/prog3/"+inputEllipsoids[whichEllipsoid].texture;

        var image = new Image();
        image.crossOrigin = "Anonymous";
        inputEllipsoids[whichEllipsoid].image = image;

        var model = inputEllipsoids[whichEllipsoid];
        setTexture(model);
    }
}

function setDepthtoDefaults(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    gl.depthMask(true);
    gl.clearDepth(1.0); // use max when we clear the depth buffer
}

// render the loaded model
function renderModels() {
   
   //setDepthtoDefaults();
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform

    function bindImageTexture(model){  

        function isPowerOf2(value) {
                    return (value & (value - 1)) == 0;
        }
        gl.bindTexture(gl.TEXTURE_2D, model.textureObject);
        if (isPowerOf2(model.image.width) && isPowerOf2(model.image.height)) {
         gl.generateMipmap(gl.TEXTURE_2D);  
        }
        else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        }
        
    } // bind textures for each model
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices
    
    //console.log("Checking animation")
    //requestAnimationFrame(renderModels);
    // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view


    // this will generate the models in descending order by alpha value
    models.forEach(function(model,modelIndex){
          gl.uniform1f(aplhaULoc,model.alpha); // pass in the alpha component

    if(model.alpha == 1)           
        gl.depthMask(true);

    if(model.alpha < 1)  
    {  
        //console.log("rendering "+model.texture, " alpha : "+model.alpha)
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD)
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      
       
    }
  

    if(model.type == modelEnum.TRIANGLES)
    {
        var currSet = inputTriangles[model.index];
        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
       // gl.uniform1f(aplhaULoc,currSet.alpha); // pass in the alpha component

        
        // vertex buffer: activate and feed into vertex shader & Textures
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[model.index]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[model.index]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[model.index]); // activate
        gl.vertexAttribPointer(texPosArrtibLoc,2,gl.FLOAT,false,0,0); // feed
        bindImageTexture(currSet); // setting the textures 
        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[model.index]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[model.index],gl.UNSIGNED_SHORT,0); // render
    }
    else
    {
        var ellipsoid = inputEllipsoids[model.index];     
        // define model transform, premult with pvmMatrix, feed to vertex shader
        makeModelTransform(ellipsoid);
        pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,ellipsoid.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,ellipsoid.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,ellipsoid.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,ellipsoid.n); // pass in the specular exponent
       // gl.uniform1f(aplhaULoc,ellipsoid.alpha); // pass in the specular exponent

        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[numTriangleSets+model.index]); // activate vertex buffer
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[numTriangleSets+model.index]); // activate normal buffer
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[numTriangleSets+model.index]); // activate tri buffer
        gl.vertexAttribPointer(texPosArrtibLoc,2,gl.FLOAT,false,0,0); // feed normal buffer to shader
        bindImageTexture(ellipsoid);// setting the textures         loadmo

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[numTriangleSets+model.index]); // activate tri buffer
        // draw a transformed instance of the ellipsoid
        gl.drawElements(gl.TRIANGLES,triSetSizes[numTriangleSets+model.index],gl.UNSIGNED_SHORT,0); // render

    }



    }); // end for each model

    

} // end render model


/* MAIN -- HERE is where execution begins after window load */



function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  setTextures();
  renderModels(); // draw the triangles using webGL
  
} // end main
