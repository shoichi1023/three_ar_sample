
var isSpawn = false;

var vrDisplay;
var vrControls;
var arView;

var canvas;
var camera;
var scene;
var renderer;
var model;

var shadowMesh;
var planeGeometry;
var light;
var directionalLight;

// var OBJ_PATH = './assets/ArcticFox_Posed.obj';
// var MTL_PATH = './assets/ArcticFox_Posed.mtl';
var OBJ_PATH = './assets/model/黒ねこ.pmx';
var SCALE = 0.1;

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API
 * to see if there are any AR-capable WebVR VRDisplays. Returns
 * a valid display if found. Otherwise, display the unsupported
 * browser message.
 */
THREE.ARUtils.getARDisplay().then(function (display) {
  if (display) {
    vrDisplay = display;
    init();
  } else {
    THREE.ARUtils.displayUnsupportedMessage();
  }
});

function init() {
  // Turn on the debugging panel
  var arDebug = new THREE.ARDebug(vrDisplay);
  document.body.appendChild(arDebug.getElement());

  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();

  // Creating the ARView, which is the object that handles
  // the rendering of the camera stream behind the three.js
  // scene
  arView = new THREE.ARView(vrDisplay, renderer);

  // The ARPerspectiveCamera is very similar to THREE.PerspectiveCamera,
  // except when using an AR-capable browser, the camera uses
  // the projection matrix provided from the device, so that the
  // perspective camera's depth planes and field of view matches
  // the physical camera on the device.
  camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  // VRControls is a utility from three.js that applies the device's
  // orientation/position to the perspective camera, keeping our
  // real world and virtual world in sync.
  vrControls = new THREE.VRControls(camera);

  // For shadows to work
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // The materials in Poly models will render as a black mesh
  // without lights in our scenes. Let's add an ambient light
  // so our model can be scene, as well as a directional light
  // for the shadow
  directionalLight = new THREE.DirectionalLight();
  // @TODO in the future, use AR light estimation
  directionalLight.intensity = 0.3;
  directionalLight.position.set(10, 15, 10);
  // We want this light to cast shadow
  directionalLight.castShadow = true;
  light = new THREE.AmbientLight();
  scene.add(light);
  scene.add(directionalLight);

  // Make a large plane to receive our shadows
  planeGeometry = new THREE.PlaneGeometry(2000, 2000);
  // Rotate our plane to be parallel to the floor
  planeGeometry.rotateX(-Math.PI / 2);

  // Create a mesh with a shadow material, resulting in a mesh
  // that only renders shadows once we flip the `receiveShadow` property
  shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
    color: 0x111111,
    opacity: 0.15,
  }));
  shadowMesh.receiveShadow = true;
  scene.add(shadowMesh);

  // THREE.ARUtils.loadModel({
  //   objPath: OBJ_PATH,
  //   // mtlPath: MTL_PATH,
  //   OBJLoader: THREE.MMDLoader(), // uses window.THREE.OBJLoader by default
  //   // MTLLoader: undefined, // uses window.THREE.MTLLoader by default
  // }).then(function(group) {
  //   model = group;
  //   // As OBJ models may contain a group with several meshes,
  //   // we want all of them to cast shadow
  //   model.children.forEach(function(mesh) { mesh.castShadow = true; });

  //   model.scale.set(SCALE, SCALE, SCALE);

  //   // Place the model very far to initialize
  //   model.position.set(10000, 10000, 10000);
  //   scene.add(model);
  // });

  var onProgress = function (xhr) {

  };
  var onError = function (xhr) {
      console.log('load mmd error');
  };

  var loader = new THREE.MMDLoader();
  loader.loadModel(OBJ_PATH, function (object) {
      model = object;
      model.children.forEach(function(mesh) { mesh.castShadow = true; });
      model.scale.set(SCALE, SCALE, SCALE);
      // Place the model very far to initialize
      model.position.set(10000, 10000, 10000);
      scene.add(model);
  }, onProgress, onError);

  // Bind our event handlers
  window.addEventListener('resize', onWindowResize, false);

  // Kick off the render loop!
  update();
}

/**
 * The render loop, called once per frame. Handles updating
 * our scene and rendering.
 */
function update() {
  /**********/
  var waitFunc = function () {

    if (!isSpawn) {
        spawn();
        return;
    }

    clearTimeout(id);
    id = setTimeout(waitFunc, 100);

  };

  var id = setTimeout(waitFunc, 1000);
  /********************/
  // Clears color from the frame before rendering the camera (arView) or scene.
  renderer.clearColor();

  // Render the device's camera stream on screen first of all.
  // It allows to get the right pose synchronized with the right frame.
  arView.render();

  // Update our camera projection matrix in the event that
  // the near or far planes have updated
  camera.updateProjectionMatrix();

  // Update our perspective camera's positioning
  vrControls.update();

  // Render our three.js virtual scene
  renderer.clearDepth();
  renderer.render(scene, camera);

  // Kick off the requestAnimationFrame to call this function
  // when a new VRDisplay frame is rendered
  vrDisplay.requestAnimationFrame(update);
}

/**
 * On window resize, update the perspective camera's aspect ratio,
 * and call `updateProjectionMatrix` so that we can get the latest
 * projection matrix provided from the device
 */
function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * When clicking on the screen, fire a ray from where the user clicked
 * on the screen and if a hit is found, place a cube there.
 */
function spawn () {
  // Inspect the event object and generate normalize screen coordinates
  // (between 0 and 1) for the screen position.
  // var x = e.clientX / window.innerWidth;
  // var y = e.clientY / window.innerHeight;
  var x = 0.5;
  var y = 0.5;

  // Send a ray from the point of click to the real world surface
  // and attempt to find a hit. `hitTest` returns an array of potential
  // hits.
  var hits = vrDisplay.hitTest(x, y);

  if (!model) {
    console.warn('Model not yet loaded');
    return;
  }

  // If a hit is found, just use the first one
  if (hits && hits.length) {
    isSpawn = true;
    var hit = hits[0];

    // Turn the model matrix from the VRHit into a
    // THREE.Matrix4 so we can extract the position
    // elements out so we can position the shadow mesh
    // to be directly under our model. This is a complicated
    // way to go about it to illustrate the process, and could
    // be done by manually extracting the "Y" value from the
    // hit matrix via `hit.modelMatrix[13]`
    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3();
    matrix.fromArray(hit.modelMatrix);
    position.setFromMatrixPosition(matrix);

    // Set our shadow mesh to be at the same Y value
    // as our hit where we're placing our model
    // @TODO use the rotation from hit.modelMatrix
    shadowMesh.position.y = position.y;

    // Use the `placeObjectAtHit` utility to position
    // the cube where the hit occurred
    THREE.ARUtils.placeObjectAtHit(model,  // The object to place
                                   hit,   // The VRHit object to move the cube to
                                   1,     // Easing value from 0 to 1; we want to move
                                          // the cube directly to the hit position
                                   true); // Whether or not we also apply orientation

    // Rotate the model to be facing the user
    var angle = Math.atan2(
      camera.position.x - model.position.x,
      camera.position.z - model.position.z
    );
    model.rotation.set(0, angle, 0);
  }
}