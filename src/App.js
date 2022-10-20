import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import ThreeMeshUI from "three-mesh-ui";
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

let camera, scene, renderer;

let controller1, controller2;
let controllerGrip1, controllerGrip2;
let pickHelper;
let container, textContainer;

class App {
	async start(){
		//scene
		scene = new THREE.Scene();
		scene.background = new THREE.Color( 0x505050 );
		camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1000 );
		camera.position.set( 0, 1, 0 );
		scene.add(camera)

		scene.add( new THREE.HemisphereLight( 0x606060, 0x404040 ) );
		const light = new THREE.DirectionalLight( 0xffffff );
		light.position.set( 1, 1, 1 ).normalize();
		scene.add( light );

		// ROOM
		const room = new THREE.LineSegments(
			new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ).translate( 0, 3, 0 ),
			new THREE.LineBasicMaterial( { color: 0x808080 } )
		);

		scene.add( room );

		// TEXT PANEL
		makeTextPanel();

		//render
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.xr.enabled = true;
		renderer.localClippingEnabled = true;
		document.body.appendChild( renderer.domElement ); 
		document.body.appendChild( VRButton.createButton( renderer ) );

		animate();

		this.init();
	}
	init() {
		// controllers
		function onSelectStart() {
			this.userData.isSelecting = true;
		}
		function onSelectEnd() {
			this.userData.isSelecting = false;
		}
		controller1 = renderer.xr.getController( 0 );
		controller1.addEventListener( 'selectstart', onSelectStart );
		controller1.addEventListener( 'selectend', onSelectEnd );
		controller1.addEventListener( 'connected', function ( event ) {
			this.add( buildController( event.data ) );
		} );
		// controller1.addEventListener('squeeze', (e) => {console.log('squeeze', e);});
		controller1.addEventListener( 'disconnected', function () {
			this.remove( this.children[ 0 ] );
		} );
		scene.add( controller1 );

		controller2 = renderer.xr.getController( 1 );
		controller2.addEventListener( 'selectstart', onSelectStart );
		controller2.addEventListener( 'selectend', onSelectEnd );
		controller2.addEventListener( 'connected', function ( event ) {
			this.add( buildController( event.data ) );
		} );
		controller2.addEventListener( 'disconnected', function () {
			this.remove( this.children[ 0 ] );
		} );
		scene.add( controller2 );

		const controllerModelFactory = new XRControllerModelFactory();

		controllerGrip1 = renderer.xr.getControllerGrip( 0 );
		controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
		scene.add( controllerGrip1 );

		controllerGrip2 = renderer.xr.getControllerGrip( 1 );
		controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
		scene.add( controllerGrip2 );	

		pickHelper = new ControllerPickHelper(scene);
	}
}

class ControllerPickHelper extends THREE.EventDispatcher {
    constructor(scene) {
      super();
      this.raycaster = new THREE.Raycaster();
      this.objectToColorMap = new Map();
      this.controllerToObjectMap = new Map();
      this.tempMatrix = new THREE.Matrix4();

      const pointerGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);

      this.controllers = [];

	  //--- startClick ----
      const selectListener = (event) => {
        const controller = event.target;
        const selectedObject = this.controllerToObjectMap.get(event.target);
        if (selectedObject) {
          this.dispatchEvent({type: event.type, controller, selectedObject});
        }
		//console.log('click', event)
		if (event.type != 'selectstart')
			return;

		this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

      };
	  //------- endClick -------------
      const endListener = () => {
        
      };
	  //------- end of endClick -------------
      for (let i = 0; i < 2; ++i) {
        const controller = renderer.xr.getController(i);
        //controller.addEventListener('select', selectListener);
        // controller.addEventListener('selectstart', selectListener);
        // controller.addEventListener('selectend', endListener);
        controller.addEventListener('squeeze', (e) => {
			console.log('squeeze', e);
			let text = new ThreeMeshUI.Text( {
				content: "type=" + e.type,
				fontSize: 0.1,
				fontFamily: "./assets/Roboto-msdf.json",
				fontTexture: "./assets/Roboto-msdf.png",
			} );
			textContainer.add( text );

			text = new ThreeMeshUI.Text( {
				content: "\ndata=" + JSON.stringify(e.data),
				fontSize: 0.1,
				fontFamily: "./assets/Roboto-msdf.json",
				fontTexture: "./assets/Roboto-msdf.png",
			} );
			textContainer.add( text );

			text = new ThreeMeshUI.Text( {
				content: "\ntarget=" + JSON.stringify(e.target),
				fontSize: 0.1,
				fontFamily: "./assets/Roboto-msdf.json",
				fontTexture: "./assets/Roboto-msdf.png",
			} );
			textContainer.add( text );
		});
        scene.add(controller);

        const line = new THREE.Line(pointerGeometry);
        line.scale.z = 20;
        controller.add(line);
        this.controllers.push({controller, line});
      }
    }
	//reset
    reset() {
      // restore the colors
      this.objectToColorMap.forEach((color, object) => {
        object.material.emissive.setHex(color);
      });
      this.objectToColorMap.clear();
      this.controllerToObjectMap.clear();
    }
	//update - for hover
    update(scene) {
      this.reset();

      for (const {controller, line} of this.controllers) {
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersections = this.raycaster.intersectObjects(scene.children, true);
		line.scale.z = 20;
		
      }
    }
  }

function buildController( data, name ) {
	let geometry, material;
	switch ( data.targetRayMode ) {
		case 'tracked-pointer':
			geometry = new THREE.BufferGeometry();
			geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
			geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

			material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

			return new THREE.Line( geometry, material );

		case 'gaze':
			geometry = new THREE.RingGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
			material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
			return new THREE.Mesh( geometry, material );
	}
}

function animate() {	
	renderer.setAnimationLoop( render );
}

function render() {

	pickHelper.update(scene);

	ThreeMeshUI.update();
	renderer.render( scene, camera );
}

function makeTextPanel() {
	container = new ThreeMeshUI.Block( {
		height: 0.7,
		width: 0.6,
		padding: 0.05,
		justifyContent: 'center',
		backgroundOpacity: 1,
		backgroundColor: new THREE.Color( 'grey' )
	} );

	// container.setupState( {
	// 	state: 'hidden-on',
	// 	attributes: { hiddenOverflow: true }
	// } );

	// container.setupState( {
	// 	state: 'hidden-off',
	// 	attributes: { hiddenOverflow: false }
	// } );

	// container.setState( 'hidden-on' );

	container.position.set( 0, 2, -1.8 );
	container.rotation.x = 0;
	scene.add( container );

	//

	textContainer = new ThreeMeshUI.Block( {
		width: 5,
		height: 3,
		padding: 0.09,
		backgroundColor: new THREE.Color( 'blue' ),
		backgroundOpacity: 0.5,
		justifyContent: 'center'
	} );

	container.add( textContainer );

	// const imgBlock = new ThreeMeshUI.Block({
	// 	height: 1,
	// 	width: 1,
	// 	alignContent: "left",
	// 	justifyContent: "start",
	// 	padding: 0.1,
	// 	backgroundColor: new THREE.Color( 'white' ),
	// 	backgroundOpacity: 1,
	// 	backgroundSize: "contain"
	// });  
	// container.add(imgBlock);

	//
	// var c = document.getElementById("helperCanvas");
	// c.width = 1600;
	// c.height = 1046;
    // var ctx = c.getContext("2d");

    // var img = document.getElementById("reportImage");
    // ctx.drawImage(img, 0, 0);

	// const centerX = c.width / 2;
	// const centerY = c.height / 2;
	// const radius = 70;

	// ctx.beginPath();
	// ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
	// ctx.fillStyle = 'red';
	// ctx.fill();
	// ctx.lineWidth = 5;
	// ctx.strokeStyle = '#ff0000';
	// ctx.stroke();

	// const ct = new THREE.CanvasTexture(c)

	// const loader = new THREE.TextureLoader();  
	// loader.load('./assets/img/reportDiagram.png', function (texture) {
	// 	console.log(texture);
	// 	imgBlock.set({ backgroundTexture: texture });
	// });

	// console.log(ct);
	// imgBlock.set({ backgroundTexture: ct });

	// const text = new ThreeMeshUI.Text( {
	// 	content: 'hiddenOverflow '.repeat( 28 ),
	// 	fontSize: 0.054,
	// 	fontFamily: "./assets/Roboto-msdf.json",
    // 	fontTexture: "./assets/Roboto-msdf.png",
	// } );

	// textContainer.add( text );

	// setInterval( () => {
	// 	if ( container.currentState === 'hidden-on' ) {
	// 		container.setState( 'hidden-off' );
	// 	} else {
	// 		container.setState( 'hidden-on' );
	// 	}
	// }, 1500 );

}


export default App;