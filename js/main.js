
var modelReady = false;

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


var clock = new THREE.Clock();
var helper;
var vmdIndex = 0;
var MMD_PATH = '../mmd/miku/Lat式ミクVer2.31_Normal.pmd';
var vmdFiles = [
  {
    name: "repeat",
    file: "../mmd/vmd_repeat/repeat.vmd"
  }
];
var SCALE = 0.02;

//ARが使えるかどうかの判定
THREE.ARUtils.getARDisplay().then(function (display) {
  if (display) {
    vrDisplay = display;
    init();
  } else {
    THREE.ARUtils.displayUnsupportedMessage();
  }
});

function init() {
  //デバッグパネルを画面上に表示
  var arDebug = new THREE.ARDebug(vrDisplay);
  document.body.appendChild(arDebug.getElement());

  //背景を透明にする
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();

  //カメラからの映像を背景(というよりは背景のもう一個奥のディスプレイのレイヤー)にセット
  arView = new THREE.ARView(vrDisplay, renderer);

  // 大体three.jsのカメラと一緒だが、現実のカメラとの奥行きの同期ができるようになるっぽい？
  camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  //現実のカメラの動きとVR(scene)のカメラを同期させる
  vrControls = new THREE.VRControls(camera);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  directionalLight = new THREE.DirectionalLight();
  // 将来的にはAR専用のライトを使うようになるらしい
  directionalLight.intensity = 0.3;
  directionalLight.position.set(10, 15, 10);
  // ここの光で影を作ってる
  directionalLight.castShadow = true;
  light = new THREE.AmbientLight();
  scene.add(light);
  scene.add(directionalLight);

  // 影を映すためのオブジェクト
  planeGeometry = new THREE.PlaneGeometry(2000, 2000);
  // 現実の床に合わせて回転させてる
  planeGeometry.rotateX(-Math.PI / 2);

  // 影を含むメッシュを作成してる
  //メッシュじゃないほうがいい場合はreceiveShadowをfalseにすれば影をレンダリングするだけになる
  shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
    color: 0x111111,
    opacity: 0.15,
  }));
  shadowMesh.receiveShadow = true;
  scene.add(shadowMesh);

  var onProgress = function(xhr) {};
  var onError = function(xhr) {
    console.log("load mmd error");
  }; //アニメーションをつけるためのヘルパー

  helper = new THREE.MMDHelper(); //MMDLoaderをインスタンス化
  var loader = new THREE.MMDLoader();
  //loadModelメソッドにモデルのPATH
  //コールバックに画面に描画するための諸々のプログラムを書く
  loader.loadModel(
    MMD_PATH,
    function(object) {
      model = object
      model.children.forEach(function(mesh) { mesh.castShadow = true; });
      model.scale.set(SCALE, SCALE, SCALE);
      model.position.set(10000, 10000, 10000);
      scene.add(model);

      helper.add(model);
      //vmdFileがあれば対応付けする
      if (vmdFiles && vmdFiles.length !== 0) {
        function readAnime() {
          var vmdFile = vmdFiles[vmdIndex].file;
          //vmdのローダー
          loader.loadVmd(
            vmdFile,
            function(vmd) {
              loader.createAnimation(model, vmd, vmdFiles[vmdIndex].name);
              vmdIndex++;
              if (vmdIndex < vmdFiles.length) {
                //配列分読み込むまで再帰呼び出し
                readAnime();
              }else{
                //モデルに対してアニメーションをセット
                helper.setAnimation(model);
                helper.unifyAnimationDuration({ afterglow: 1.0 });
                model.mixer.stopAllAction();
                //実行
                selectAnimation(model, 0, true);
              }
            },
            onProgress,
            onError
          );
        }
        readAnime();
      }
      modelReady = true;
    },
    onProgress,
    onError
  );


  window.addEventListener('resize', onWindowResize, false);
  canvas.addEventListener('click', spawn, false);

  update();
}

function update() {

  // いま表示されてるのものをクリア
  renderer.clearColor();

  //現実のカメラと同期してオブジェクトを正しい場所に相対的に移動
  arView.render();

  //床用のオブジェクトを更新(おそらくこれがしたいがためにARのカメラを使用している)
  camera.updateProjectionMatrix();

  // 現実のカメラに合わせてカメラの位置をアップデート
  vrControls.update();
　
  //VR空間を描画
  renderer.clearDepth();
  renderer.render(scene, camera);

  // アニメーションフレームはVR空間が描画されたあと
  vrDisplay.requestAnimationFrame(update);

  if (modelReady) {
    helper.animate(clock.getDelta());
  }
}

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

//オブジェクトを描画するための関数
function spawn (e) {
  var x = e.clientX / window.innerWidth;
  var y = e.clientY / window.innerHeight;

  //擬似的な光線を発射し、(おそらく床用のオブジェクトとの)衝突判定を行っている
  var hits = vrDisplay.hitTest(x, y);

  if (!model) {
    console.warn('Model not yet loaded');
    return;
  }

  // 衝突したらオブジェクトを描画
  if (hits && hits.length) {
    var hit = hits[0];
    
    //これで現実世界の床の上になるような正しい位置(かつ影がうまいこと表示できる位置)を取得
    //どうやら影をうまいこと描画するプロセスが複雑らしいが詳しいことは割愛(わかる方いたら教えてください)
    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3();
    matrix.fromArray(hit.modelMatrix);
    position.setFromMatrixPosition(matrix);

    // 影をセット、今後その影も現実に合わせて回転するようになるっぽい？
    shadowMesh.position.y = position.y;
    
    // モデルをその場所にセット
    THREE.ARUtils.placeObjectAtHit(model,hit,1,true);

    // 現実のカメラに合わせてオブジェクトを回転
    var angle = Math.atan2(
      camera.position.x - model.position.x,
      camera.position.z - model.position.z
    );
    model.rotation.set(0, angle, 0);
  }
}


//通常の関連付けだとモーフファイル(表情のモーションファイル)と分離されてしまうのでくっつけて実行するためのヘルパー
function selectAnimation(mesh, index, loop) {
  var clip, mclip, action, morph, i;
  i = 2 * index;
  //一つのアニメーションを抜き出し(モーフじゃない方)
  clip = mesh.geometry.animations[i];
  //ミキサーにセット
  action = mesh.mixer.clipAction(clip);
  //対応するモーフを抜き出し
  mclip = mesh.geometry.animations[i + 1];
  //ミキサーにセット
  morph = mesh.mixer.clipAction(mclip);
  //ループの設定、
  if (loop) {
    action.repetitions = "Infinity";
    morph.repetitions = "Infinity";
  } else {
    action.repetitions = 0;
    morph.repetitions = 0;
  }
  //一旦全部止めて
  mesh.mixer.stopAllAction();
  //同時に動かす
  action.play();
  morph.play();
}