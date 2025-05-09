// --- Start of the file (Imports, WebGL check, Scene, Fog, Camera, Renderer, CSS Renderer, Lighting, Flicker Vars, etc.) ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { initWorldScene, cleanupWorldScene } from './worldScene.js'; // Import functions for scene 2

// --- WebGL Support Check ---
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
if (!gl) {
    document.body.innerHTML = "<h1>Your browser does not support WebGL.</h1>";
    throw new Error("WebGL is not supported on this browser.");
}

// --- Scene Setup (Scene 1) ---
let scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Light background for Scene 1

// --- Fog Setup (Scene 1) ---
const fogColor = 0xf0f0f0; // Match background
const fogDensity = 0.0002; // Adjust density as needed
scene.fog = new THREE.FogExp2(fogColor, fogDensity);

// --- Camera Setup ---
const zoomedOutFov = 35; // FOV when camera is at initial position
const zoomedInFov = 25; // FOV when camera is zoomed in
let camera = new THREE.PerspectiveCamera(zoomedOutFov, window.innerWidth / window.innerHeight, 0.1, 100);
const initialCameraPos = new THREE.Vector3(0, 0, 14); // Start further back
const initialCameraRot = new THREE.Euler(0, 0, 0);
camera.position.copy(initialCameraPos);
camera.rotation.copy(initialCameraRot);

// --- WebGL Renderer Setup ---
let renderer = new THREE.WebGLRenderer({ alpha: true }); // Allow transparency for potential layering
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
renderer.toneMappingExposure = 0.9; // Adjust exposure
document.body.appendChild(renderer.domElement); // Add the WebGL canvas to the page

// --- CSS3D Renderer Setup (for iframe) ---
let cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute'; // Overlay on top of WebGL
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.pointerEvents = 'none'; // Allow clicks to pass through by default
cssRenderer.domElement.id = 'css-renderer'; // Assign an ID for potential styling/reference
document.body.appendChild(cssRenderer.domElement); // Add the CSS3D div to the page

// --- DOM References ---
const eyelidTop = document.getElementById('eyelid-top');
const eyelidBottom = document.getElementById('eyelid-bottom');
const hudFrame = document.getElementById('hudFrame'); // Iframe for the loading screen
const glitchOverlay = document.getElementById('glitch-overlay'); // Div for the glitch effect

// --- LIGHTING SETUP (Scene 1) ---
let overheadLight = new THREE.DirectionalLight(0xad8121, .05); // Slightly warmer directional light
overheadLight.position.set(0, 0, 8); // Positioned above
overheadLight.target.position.set(0, 0, 0); // Target the center
scene.add(overheadLight);
scene.add(overheadLight.target);
let ambientLight; // Declared but not used (commented out below)
//let ambientLight = new THREE.AmbientLight(0x999966, .005); // Warmer ambient
//scene.add(ambientLight);
let monitorLight; // Declared but not used (commented out below)
//let monitorLight = new THREE.PointLight(0xaaaaff, 3.5, 8); // Blueish light from monitor
//monitorLight.position.set(0, 0, 2); // Slightly in front of expected monitor position
//scene.add(monitorLight);


// --- Flicker Variables (Only for Overhead Light now) ---
let isOverheadFlickering = false;
const overheadFlickerDuration = 4000; // ms
let overheadFlickerStartTime = 0; // Initialize
let baseOverheadIntensity = overheadLight.intensity;
const overheadFlickerMinIntensity = baseOverheadIntensity * 0.1;
const overheadFlickerMaxIntensity = baseOverheadIntensity * 1.1;
const minOverheadFlickerInterval = 20000; // ms
const maxOverheadFlickerInterval = 45000; // ms
const overheadFlickerChangeProbability = 0.05; // Chance per frame to start/stop flicker

// --- Post-processing Setup (Scene 1 - Bloom Effect) ---
let composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); // Render the scene first
let bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), // Resolution
    .1, // Strength -> Adjusted
    .2, // Radius -> Adjusted
    .8 // Threshold -> Adjusted
);
composer.addPass(bloomPass); // Add the bloom effect pass

// --- GLTF Loader and Model Variables (Scene 1) ---
const loader = new GLTFLoader(); // Loader for GLTF models
let screenWarpModel, websiteFrame; // For the iframe projection
let roomModel; // Variable for the room model
let iframe; // The HTML iframe element
let websiteContainer; // Container div for the iframe
let glassMesh; // Semi-transparent glass pane in front of iframe
let faceplugModel; // The faceplug model

// --- State Flags ---
let isMouseOverIframe = false; // Tracks if the mouse is hovering over the iframe area
let faceplugAnimationCompleted = false; // Tracks if the faceplug animation has finished
let eyesClosingStarted = false; // Tracks if the eyes closing animation has begun
let scene1Active = true; // Flag indicating if Scene 1 is currently active and should be rendered
let originalIframePosition = new THREE.Vector3(); // Stores initial iframe position
let originalIframeRotation = new THREE.Euler(); // Stores initial iframe rotation
let originalIframeScale = new THREE.Vector3(); // Stores initial iframe scale

// --- Faceplug Animation Variables ---
let isFaceplugAnimating = false; // Flag indicating if the faceplug is currently animating
let faceplugAnimStartTime = 0; // Timestamp when the faceplug animation started
const faceplugAnimDuration = 3500; // Duration of the faceplug animation in ms
const faceplugStartPos = new THREE.Vector3(); // Starting position of the faceplug model
const faceplugTargetPos = new THREE.Vector3(0, 0, 3.3); // Target position for faceplug (closer to camera)

// --- Animation Frame ID (Scene 1) ---
let animationFrameId = null; // Stores the ID returned by requestAnimationFrame for Scene 1

// *** NEW: Inactivity Timer Variables ***
let inactivityTimer = null; // Stores the timeout ID for the inactivity timer
const inactivityTimeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

// --- MODEL LOADING AND SCENE SETUP (Scene 1) ---

// Load screenwarp.gltf (used as the plane to project the iframe onto)
loader.load('./screenwarp.gltf', (gltf) => {
    screenWarpModel = gltf.scene;
    scene.add(screenWarpModel);

    // Find the specific mesh within the loaded model to map the iframe to
    const screenMesh = screenWarpModel.getObjectByName("screenwarp");
    if (!screenMesh) {
        console.error("Mesh 'screenwarp' not found in screenwarp.gltf");
        return;
    }

    // Create the HTML iframe element
    iframe = document.createElement('iframe');
    iframe.src = "desktop.html"; // Source HTML file for the iframe content
    iframe.style.width = "1024px"; // Intrinsic size of the iframe content
    iframe.style.height = "768px";
    iframe.style.border = "0"; // No border
    iframe.style.pointerEvents = 'auto'; // Allow interaction with the iframe content
    iframe.style.backgroundColor = 'transparent'; // Make background transparent
    iframe.setAttribute('allowtransparency', 'true'); // Necessary for transparency in some browsers

    // Create a container div for the iframe (helps with scaling and positioning)
    websiteContainer = document.createElement('div');
    websiteContainer.style.width = "1024px";
    websiteContainer.style.height = "768px";
    websiteContainer.style.overflow = "hidden"; // Clip content if needed
    websiteContainer.style.backgroundColor = 'transparent'; // Container background
    websiteContainer.appendChild(iframe);

    // Create the CSS3D object using the container div
    websiteFrame = new CSS3DObject(websiteContainer);

    // Calculate the size of the target mesh in world units
    const box1 = new THREE.Box3().setFromObject(screenMesh);
    const size1 = new THREE.Vector3();
    box1.getSize(size1);

    // Scale the CSS3D object to match the size of the target mesh
    websiteFrame.scale.set(size1.x / 1024, size1.y / 768, 1);

    // Position the CSS3D object at the same location as the target mesh
    screenMesh.getWorldPosition(websiteFrame.position);
    scene.add(websiteFrame); // Add the CSS3D object to the scene

    // Store original transform for potential reset
    originalIframePosition.copy(websiteFrame.position);
    originalIframeRotation.copy(websiteFrame.rotation);
    originalIframeScale.copy(websiteFrame.scale);

    // Create a semi-transparent glass pane in front of the iframe for visual effect
    const box = new THREE.Box3().setFromObject(screenMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const glassGeometry = new THREE.PlaneGeometry(size.x, size.y);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.03,
        metalness: 0.9,
        reflectivity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });
    glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
    glassMesh.position.copy(websiteFrame.position); // Position same as iframe
    glassMesh.position.z += 0.02; // Place slightly in front
    scene.add(glassMesh); // Add the glass pane to the scene

    // Basic dragging setup (placeholder - not fully implemented)
    websiteContainer.style.cursor = 'move'; // Indicate draggable
    websiteContainer.addEventListener('mousedown', (e) => {
        if (e.target === iframe) return; // Don't drag if clicking inside iframe content
        // Add dragging logic here if needed
    });
    document.addEventListener('mouseup', () => {
        // Stop dragging logic here
    });

    // Add event listeners that call the central activity handler to reset the inactivity timer
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity, true); // Use capture phase for clicks

    // Mouse hover detection for zooming effect
    iframe.addEventListener('mouseenter', () => {
        if (!scene1Active) return; // Only react if Scene 1 is active
        isMouseOverIframe = true;
        zoomTargetZ = zoomInDistance; // Set target zoom distance
        targetX = 0; // Reset camera rotation targets
        targetY = 0;
        handleUserActivity(); // Reset inactivity timer on hover
    });
    iframe.addEventListener('mouseleave', () => {
         if (!scene1Active) return;
         isMouseOverIframe = false;
         // Don't zoom out immediately on mouse leave, requires clicking outside
         targetX = 0; // Reset camera rotation targets
         targetY = 0;
         handleUserActivity(); // Reset inactivity timer
    });

});

// Load ROOM.glb (the environment model for Scene 1)
loader.load('./ROOM.glb', (gltf) => {
    roomModel = gltf.scene; // Assign loaded scene to roomModel variable
    // Optional: Traverse and apply settings if needed (e.g., shadows)
    roomModel.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            // You might need to adjust material properties here if they aren't set correctly in the GLB
            // e.g., node.material.roughness = 1; node.material.metalness = 0;
        }
    });
    scene.add(roomModel); // Add the room model to the scene
    console.log("ROOM.glb model loaded.");
}, undefined, (error) => {
    console.error('An error happened loading ROOM.glb:', error);
});

// Load faceplug.gltf (the model that animates towards the camera)
loader.load('./faceplug.gltf', (gltf) => {
    faceplugModel = gltf.scene;
    scene.add(faceplugModel); // Add the faceplug model to the scene
    console.log("Faceplug model loaded.");
    // Initialize start position for animation (likely its default position in the GLTF)
    faceplugStartPos.copy(faceplugModel.position);
}, undefined, (error) => {
    console.error('An error happened loading faceplug.gltf:', error);
});


// --- Variables & Listeners for Camera Control and Zoom ---
const raycaster = new THREE.Raycaster(); // Used for detecting mouse intersections (not currently used for zoom)
const mouse = new THREE.Vector2(); // Stores normalized mouse coordinates (not currently used for zoom)
let targetX = 0, targetY = 0; // Target camera rotation based on mouse position (when zoomed out)
const smoothFactor = 0.07; // Smoothing factor for camera rotation interpolation
const fovSmoothFactor = 0.05; // Smoothing factor specifically for FOV changes
const fullRotationRange = 0.04; // Max rotation angle based on mouse position
const zoomTiltAngle = -2 * Math.PI / 180; // Angle to tilt camera down when zoomed in
let zoomTargetZ = initialCameraPos.z; // Target Z position for camera (changes on hover/click)
const zoomInDistance = 3.5; // How close the camera zooms in
const zoomSpeed = 0.049; // Speed of the zoom interpolation
const zoomInTargetY = .17; // Target Y position for the camera when zoomed in


// --- Screen Glitch Function ---
let glitchTimeoutId = null; // Stores the timeout ID for the glitch effect duration
/**
 * Triggers a CSS-based screen glitch effect.
 * @param {number} [duration=800] - Duration of the glitch effect in milliseconds.
 * @param {boolean} [shortGlitch=false] - (Currently unused) Flag for a potentially different short glitch style.
 */
function triggerScreenGlitchEffect(duration = 800, shortGlitch = false) {
    console.log(`DEBUG: Entering triggerScreenGlitchEffect(${duration}, shortGlitch=${shortGlitch})`);
    if (!glitchOverlay) {
        console.warn("DEBUG: Glitch overlay element not found in triggerScreenGlitchEffect.");
        return;
    }
    console.log("DEBUG: Glitch overlay element found.");
    // Clear any existing glitch timeout
    if (glitchTimeoutId) {
        clearTimeout(glitchTimeoutId);
        console.log("DEBUG: Cleared previous glitch timeout.");
    }

    // Apply the requested duration via a CSS custom property
    glitchOverlay.style.setProperty('--glitch-duration', `${duration}ms`);

    console.log("DEBUG: Adding 'active' class to glitch overlay.");
    glitchOverlay.classList.add('active'); // Activate the glitch animation by adding the class

    // Set a timeout to remove the 'active' class after the specified duration
    glitchTimeoutId = setTimeout(() => {
        if (glitchOverlay) {
             glitchOverlay.classList.remove('active'); // Deactivate animation
             glitchOverlay.style.removeProperty('--glitch-duration'); // Clean up CSS variable
             console.log("DEBUG: Glitch effect timeout finished, removed 'active' class.");
        } else {
             console.warn("DEBUG: Glitch timeout finished, but overlay element was null.");
        }
        glitchTimeoutId = null; // Clear the timeout ID
    }, duration);
    console.log(`DEBUG: Set glitch timeout for ${duration}ms.`);
}


// --- Listener for messages from iframe ---
window.addEventListener('message', (event) => {
    console.log("DEBUG: Message received in main.js:", event.data);
    // Basic validation of the received message
    if (!event.data || !event.data.type) return;
    const payload = event.data.payload || {}; // Extract payload if it exists

    // Handle specific message types
    if (event.data.type === 'userInteractionClick') {
        // Any click inside the iframe is considered user activity
        handleUserActivity(); // Reset inactivity timer
    }
    else if (event.data.type === 'paymentConfirmed') {
        // Trigger a short visual glitch on payment confirmation
        console.log("DEBUG: 'paymentConfirmed' message received.");
        triggerScreenGlitchEffect(150, true); // Short glitch
        handleUserActivity(); // Payment is activity
    }
    // --- MODIFIED: startTransitionGlitch handler ---
    else if (event.data.type === 'startTransitionGlitch') {
        console.log("DEBUG: 'startTransitionGlitch' message received. Initiating transition sequence.");
        handleUserActivity(); // Starting transition is activity

        // 1. Remove iframe/glass immediately
        console.log("DEBUG: Removing websiteFrame and glassMesh immediately.");
        if (websiteFrame && scene && websiteFrame.parent === scene) {
            scene.remove(websiteFrame); console.log("DEBUG: websiteFrame removed.");
            // Also remove the container from the CSS renderer's DOM
            if (websiteContainer && cssRenderer && websiteContainer.parentNode === cssRenderer.domElement) {
                 cssRenderer.domElement.removeChild(websiteContainer); console.log("DEBUG: websiteContainer removed.");
            }
            // Nullify references
            websiteFrame = null; websiteContainer = null; iframe = null;
        } else { console.log("DEBUG: websiteFrame not found or already removed."); }

        if (glassMesh && scene && glassMesh.parent === scene) {
            scene.remove(glassMesh); console.log("DEBUG: glassMesh removed.");
            glassMesh = null;
        } else { console.log("DEBUG: glassMesh not found or already removed."); }
        isMouseOverIframe = false; // Ensure hover state is false

        // 2. Start faceplug animation (if model exists)
        console.log("DEBUG: Checking faceplugModel to start animation...");
        if (faceplugModel) {
            console.log("DEBUG: Starting faceplug animation immediately.");
            isFaceplugAnimating = true;
            faceplugAnimationCompleted = false; // Reset completion flag
            eyesClosingStarted = false;         // Reset eyes closing flag
            faceplugAnimStartTime = Date.now(); // Record start time
            faceplugStartPos.copy(faceplugModel.position); // Record start position
        } else {
            console.warn("DEBUG: Faceplug model not loaded, cannot start animation.");
            // If faceplug doesn't load, we might need a fallback or alternative sequence here.
            // For now, the glitch and eyes closing will still be attempted.
        }

        // 3. Glitch effect is now triggered *after* faceplug animation completes (in animate loop).

        // 4. Set timeout to start eyes closing AFTER the glitch *would have* finished
        //    (The glitch duration is still used for timing the eyes closing).
        const glitchDuration = 3000; // Keep the desired delay for eyes closing
        console.log(`DEBUG: Setting ${glitchDuration}ms timeout to start eyes closing (after glitch duration).`);
        setTimeout(() => {
             // Check if Scene 1 is still active and eyes haven't started closing yet
             if (scene1Active && !eyesClosingStarted) {
                console.log("DEBUG: Glitch duration timer finished, starting eyes closing.");
                startEyesClosingAnimation(); // Start closing eyes now
             } else {
                 console.log("DEBUG: Glitch timer finished, but scene changed or eyes closing already started. Aborting eyes close trigger.");
             }
        }, glitchDuration);
    }
    // --- End MODIFICATION ---
    // Other message handlers...
    else if (event.data.type === 'startDownload') { handleUserActivity(); /* Placeholder for download logic */ }
    else if (event.data.type === 'openPurchaseScreen') { handleUserActivity(); /* Placeholder for purchase logic */ }
    else if (event.data.type === 'navigateBrowser') { handleUserActivity(); /* Placeholder for navigation logic */ }
    else if (event.data.type === 'closeAdPopup') { handleUserActivity(); /* Placeholder for ad logic */ }
    else if (event.data.type === 'closeCardEntryPopup') {
        handleUserActivity(); // Closing popup is activity
        console.log("DEBUG: 'closeCardEntryPopup' message received. (Main script action handled by 'paymentConfirmed')");
    }
});


// --- Eyes Closing and HUD Functions ---

/**
 * Starts the CSS animation to close the eyelids.
 */
function startEyesClosingAnimation() {
    // Ensure eyelid elements exist
    if (!eyelidTop || !eyelidBottom) { console.error("Eyelid elements not found!"); return; }
    // Prevent starting the animation multiple times
    if (eyesClosingStarted) { console.log("DEBUG: Eyes closing already started, ignoring duplicate call."); return; }
    console.log("DEBUG: Starting eyes closing animation.");
    eyesClosingStarted = true; // Set flag

    // Add the 'closing' class to trigger the CSS transition
    eyelidTop.classList.add('closing');
    eyelidBottom.classList.add('closing');

    const transitionDuration = 1500; // Match CSS transition duration (in ms)
    // Set a fallback timeout in case the transitionend events don't fire reliably
    const fallbackTimeout = setTimeout(onEyesClosed, transitionDuration + 100);

    let transitionsEnded = 0; // Counter for completed transitions
    // Event handler for the 'transitionend' event
    const handleTransitionEnd = (event) => {
        // Only react to the 'height' property transition
        if (event.propertyName !== 'height') return;
        transitionsEnded++;
        console.log(`DEBUG: Eyelid transition end event (${transitionsEnded}/2).`);
        // If both eyelids have finished transitioning
        if (transitionsEnded === 2) {
             console.log("DEBUG: Both eyelid transitions ended.");
             clearTimeout(fallbackTimeout); // Clear the fallback timer
             onEyesClosed(); // Proceed to the next step (scene switch)
             // Clean up event listeners to prevent memory leaks
             eyelidTop.removeEventListener('transitionend', handleTransitionEnd);
             eyelidBottom.removeEventListener('transitionend', handleTransitionEnd);
        }
    };

    // Add the event listeners to both eyelids
    eyelidTop.addEventListener('transitionend', handleTransitionEnd);
    eyelidBottom.addEventListener('transitionend', handleTransitionEnd);
}

/**
 * Starts the CSS animation to open the eyelids.
 */
function startEyesOpeningAnimation() {
    if (!eyelidTop || !eyelidBottom) { console.error("Eyelid elements not found!"); return; }
    console.log("DEBUG: Starting eyes opening animation.");
    // Remove the 'closing' class to reverse the CSS transition
    eyelidTop.classList.remove('closing');
    eyelidBottom.classList.remove('closing');
}

/**
 * Function called after the eyes have finished closing.
 * Handles cleanup of Scene 1 and initialization of Scene 2.
 */
async function onEyesClosed() {
    console.log("DEBUG: onEyesClosed called. Initiating scene switch.");
    showHud(); // Show the loading screen HUD (loader.html)
    cleanupScene1(); // Clean up resources used by Scene 1

    // Safety check: Ensure the document body exists before proceeding
    if (!document.body) { console.error("FATAL: document.body is null before initWorldScene!"); return; }

    // Define promises for minimum loading time and actual world scene loading
    const minLoadingTimePromise = new Promise(resolve => setTimeout(resolve, 5000)); // Enforce 5 seconds minimum loading time
    console.log("DEBUG: Minimum 5s loading timer started.");

    console.log("DEBUG: Calling initWorldScene...");
    // Call the initialization function from worldScene.js
    const worldLoadPromise = initWorldScene(document.body) // Pass the body as the container for the new renderer
        .then(() => { console.log("DEBUG: worldLoadPromise resolved successfully (worldScene initialized)."); })
        .catch((err) => { console.error("DEBUG: worldLoadPromise REJECTED:", err); throw err; }); // Re-throw error to be caught below

    try {
        // Wait for both the minimum loading time AND the world scene assets to finish loading
        console.log("DEBUG: Waiting for Promise.all([minLoadingTimePromise, worldLoadPromise])...");
        await Promise.all([minLoadingTimePromise, worldLoadPromise]);
        console.log("DEBUG: Promise.all COMPLETED. Hiding HUD and opening eyes.");
        hideHud(); // Hide the loading screen HUD
        startEyesOpeningAnimation(); // Start opening the eyes to reveal Scene 2
        resetInactivityTimer(); // Restart the inactivity timer for Scene 2
    } catch (error) {
        // Handle errors during the loading/initialization process
        console.error("DEBUG: Promise.all FAILED or error during Scene 2 initialization:", error);
        // Attempt to recover gracefully
        hideHud(); // Still hide the HUD on error
        startEyesOpeningAnimation(); // Still try to open the eyes
        // Optionally display an error message to the user in the main window or console
    }
}

/**
 * Shows the loading screen HUD (iframe with loader.html).
 */
function showHud() {
    if (!hudFrame) { console.error("HUD iframe element (#hudFrame) not found!"); return; }
    console.log("Showing HUD iframe (loading screen).");
    hudFrame.src = 'loader.html'; // Load the loader content
    hudFrame.style.display = 'block'; // Make it visible
}

/**
 * Hides the loading screen HUD.
 */
function hideHud() {
     if (hudFrame) {
        console.log("Hiding HUD iframe.");
        hudFrame.style.display = 'none'; // Hide it
        hudFrame.src = 'about:blank'; // Clear content to stop any scripts/animations
     } else {
        console.warn("Attempted to hide HUD, but hudFrame element was not found.");
     }
}

// --- Scene Cleanup and Initialization Functions ---

/**
 * Cleans up resources used by Scene 1 to free memory before switching to Scene 2.
 */
function cleanupScene1() {
    console.log("--- Cleaning up Scene 1 ---");
    scene1Active = false; // Mark Scene 1 as inactive
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } // Stop Scene 1's animation loop

    // Remove event listeners specific to Scene 1
    window.removeEventListener('resize', onWindowResizeScene1);
    window.removeEventListener('mousemove', handleUserActivity);
    window.removeEventListener('keydown', handleUserActivity);
    window.removeEventListener('click', handleUserActivity, true);

    // Dispose Three.js objects (geometry, materials, textures)
    if (scene) {
        const children = [...scene.children]; // Clone array because removing children modifies the original
        children.forEach(object => {
            scene.remove(object); // Remove from scene
            if (object.geometry) object.geometry.dispose(); // Dispose geometry
            if (object.material) {
                // Handle single material or array of materials
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    // Dispose textures attached to the material
                    if (material.map) material.map.dispose();
                    if (material.lightMap) material.lightMap.dispose();
                    if (material.bumpMap) material.bumpMap.dispose();
                    if (material.normalMap) material.normalMap.dispose();
                    if (material.specularMap) material.specularMap.dispose();
                    if (material.envMap) material.envMap.dispose();
                    // Dispose the material itself
                    material.dispose();
                });
            }
             // Dispose shadow maps if the object is a light with shadows
            if (object.isLight && object.shadow && object.shadow.map) {
                object.shadow.map.dispose();
            }
        });
    }

    // Dispose post-processing composer passes if they have dispose methods
    if (composer) {
        composer.passes.forEach(pass => {
            if (pass.dispose) {
                pass.dispose();
            }
        });
    }

    // Remove renderers from DOM and dispose their WebGL contexts
    if (cssRenderer && cssRenderer.domElement && cssRenderer.domElement.parentNode) {
        cssRenderer.domElement.parentNode.removeChild(cssRenderer.domElement);
    }
    if (renderer) {
         if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
         }
         renderer.dispose(); // Release WebGL context
    }

    // Nullify variables to help garbage collection
    screenWarpModel = null;
    roomModel = null;
    faceplugModel = null;
    glassMesh = null;
    websiteFrame = null;
    websiteContainer = null;
    iframe = null;
    scene = null;
    camera = null;
    ambientLight = null;
    overheadLight = null;
    monitorLight = null;
    composer = null;
    bloomPass = null;
    renderer = null;
    cssRenderer = null;

    console.log("--- Scene 1 cleanup complete. ---");
}


// --- Flicker Trigger Functions ---

/**
 * Randomly decides whether to start or stop the overhead light flickering effect
 * and schedules the next check.
 */
function triggerOverheadFlicker() {
    // Guard against null light (e.g., during cleanup)
    if (!overheadLight) return;
    // Random chance to toggle flickering state
    if (Math.random() < overheadFlickerChangeProbability) {
        isOverheadFlickering = !isOverheadFlickering;
        if (isOverheadFlickering) {
            // Record start time if flicker begins
            overheadFlickerStartTime = Date.now();
        } else {
            // Reset intensity smoothly when flicker stops manually
            overheadLight.intensity = baseOverheadIntensity;
        }
    }
    // Schedule the next time this function will run
    const nextInterval = minOverheadFlickerInterval + Math.random() * (maxOverheadFlickerInterval - minOverheadFlickerInterval);
    setTimeout(triggerOverheadFlicker, nextInterval);
}


// --- Animation Loop (Scene 1) ---
function animate() {
    // Stop the loop if Scene 1 is no longer active
    if (!scene1Active) {
        // console.log("DEBUG: Scene 1 animation loop stopped.");
        return;
    }
    // Request the next frame
    animationFrameId = requestAnimationFrame(animate);

    // --- Overhead Light Flicker Logic ---
    if (isOverheadFlickering && overheadLight) {
        const elapsed = Date.now() - overheadFlickerStartTime;
        const flickerProgress = elapsed / overheadFlickerDuration;
        if (flickerProgress < 1) {
            // Randomly vary intensity within the defined range during flicker
            overheadLight.intensity = overheadFlickerMinIntensity + Math.random() * (overheadFlickerMaxIntensity - overheadFlickerMinIntensity);
        } else {
            // End flicker cycle smoothly and reset state
            overheadLight.intensity = baseOverheadIntensity;
            isOverheadFlickering = false;
        }
    } else if (overheadLight) {
        // Ensure intensity smoothly returns to base if flicker stopped abruptly or wasn't active
        if (overheadLight.intensity !== baseOverheadIntensity) {
            overheadLight.intensity += (baseOverheadIntensity - overheadLight.intensity) * 0.1; // Smooth return
        }
    }

    // --- Faceplug Animation ---
    if (isFaceplugAnimating && faceplugModel) {
        const elapsedTime = Date.now() - faceplugAnimStartTime;
        // Calculate progress (0.0 to 1.0)
        const progress = Math.min(elapsedTime / faceplugAnimDuration, 1.0);
        // Apply easing function (quadratic ease in/out) for smoother motion
        const easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        // Interpolate position between start and target using eased progress
        faceplugModel.position.lerpVectors(faceplugStartPos, faceplugTargetPos, easedProgress);

        // Check if animation is complete
        if (progress >= 1.0) {
            isFaceplugAnimating = false; // Stop animation flag
            faceplugAnimationCompleted = true; // Set completion flag
            console.log("DEBUG: Faceplug animation finished.");

            // --- MODIFICATION: Trigger glitch effect AFTER faceplug animation completes ---
            console.log("DEBUG: Triggering screen glitch effect now (after faceplug anim).");
            const glitchDuration = 3000; // Duration for the glitch effect
            triggerScreenGlitchEffect(glitchDuration);
            // The eyes closing animation is already scheduled via setTimeout in the message handler
            // based on this same glitchDuration.
        }
    }


    // --- Camera Movement Logic (Zoom, Tilt, Rotation based on Mouse) ---
    if (scene1Active && camera) {
        // Determine if the mouse is effectively over the iframe (iframe must exist)
        const isEffectivelyMouseOverIframe = isMouseOverIframe && websiteFrame;

        // Interpolate camera Y position based on hover state (moves slightly up/down)
        const currentTargetYPos = isEffectivelyMouseOverIframe ? zoomInTargetY : initialCameraPos.y;
        camera.position.y += (currentTargetYPos - camera.position.y) * zoomSpeed;

        // Interpolate camera Z position (zoom in/out)
        camera.position.z += (zoomTargetZ - camera.position.z) * zoomSpeed;

        // Determine target camera rotation
        let targetRotationX, targetRotationY;
        let targetRotationZ = initialCameraRot.z; // Keep Z rotation stable

        if (isEffectivelyMouseOverIframe) {
            // Tilt down slightly when zoomed in
            targetRotationX = initialCameraRot.x + zoomTiltAngle;
            targetRotationY = initialCameraRot.y; // No horizontal rotation based on mouse when zoomed
        } else {
            // Rotate based on mouse position when zoomed out
            // targetX and targetY are updated by handleUserActivity on mousemove
            targetRotationX = initialCameraRot.x - targetY * fullRotationRange;
            targetRotationY = initialCameraRot.y - targetX * fullRotationRange;
        }

        // Smoothly interpolate camera rotation towards the target rotation
        camera.rotation.x += (targetRotationX - camera.rotation.x) * smoothFactor;
        camera.rotation.y += (targetRotationY - camera.rotation.y) * smoothFactor;
        camera.rotation.z += (targetRotationZ - camera.rotation.z) * smoothFactor; // Smooth Z rotation (usually minimal)

        // --- DYNAMIC FOV INTERPOLATION ---
        // Determine target FOV based on hover state
        const targetFov = isEffectivelyMouseOverIframe ? zoomedInFov : zoomedOutFov;
        // Interpolate FOV smoothly towards the target
        camera.fov += (targetFov - camera.fov) * fovSmoothFactor;
        // Apply the FOV change by updating the camera's projection matrix
        camera.updateProjectionMatrix();
        // --- END FOV INTERPOLATION ---
    }

    // --- Render ---
    if (scene1Active) {
        // Render CSS3D objects first (if they exist and are in the scene)
        if (websiteFrame && cssRenderer && scene && camera) {
             // Safety check: Ensure websiteFrame is still attached to the scene before rendering
             if (websiteFrame.parent === scene) {
                cssRenderer.render(scene, camera);
             } else {
                 // console.warn("DEBUG: Attempted to render CSS but websiteFrame not in scene.");
             }
        }
        // Render WebGL scene using the composer (handles WebGL renderer + bloom pass)
        if (composer && scene && camera) {
            composer.render();
        }
    }
}
// --- End Animation Loop (Scene 1) ---


// --- Window Resize Handler (Scene 1) ---
function onWindowResizeScene1() {
    // Only run if Scene 1 components are active and initialized
    if (!scene1Active || !camera || !renderer || !cssRenderer || !composer || !bloomPass) return;

    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // Important after changing aspect or FOV

    // Update renderer and composer sizes
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // Update composer size
    // Update bloom pass resolution if it exists
    if (bloomPass) bloomPass.resolution.set(window.innerWidth, window.innerHeight);
}
// Add the resize listener
window.addEventListener('resize', onWindowResizeScene1, false);


// *** NEW: Inactivity Timer Functions ***

/**
 * Reloads the page when inactivity timeout is reached.
 */
function reloadPage() {
    console.log(`Inactivity detected after ${inactivityTimeoutDuration / 1000 / 60} minutes. Reloading application.`);
    window.location.reload();
}

/**
 * Resets the inactivity timer. Clears the existing timer and starts a new one.
 */
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer); // Clear existing timer
    }
    // console.log(`DEBUG: Inactivity timer reset (${inactivityTimeoutDuration / 1000}s)`); // Optional: Log reset
    // Start a new timer
    inactivityTimer = setTimeout(reloadPage, inactivityTimeoutDuration);
}

/**
 * Central handler for various user activity events. Resets the inactivity timer
 * and handles Scene 1 specific interactions (mouse move for camera, click to zoom out).
 * @param {Event} event - The event object (e.g., mousemove, keydown, click).
 */
function handleUserActivity(event) {
    // Reset the inactivity timer on any detected activity
    resetInactivityTimer();

    // Handle mouse movement for camera rotation (only when Scene 1 is active and not hovering over iframe)
    if (scene1Active && event && event.type === 'mousemove' && !isMouseOverIframe) {
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        // Update targetX/Y based on normalized mouse coordinates (-1 to 1)
        targetX = (event.clientX - halfWidth) / halfWidth;
        targetY = (event.clientY - halfHeight) / halfHeight;
    }

    // Handle Scene 1 specific click-to-zoom-out logic
    if (scene1Active && event && event.type === 'click') {
        // Check if the iframe projection elements still exist
        if (!websiteFrame || !iframe || !websiteContainer) return;

        let clickedOnIframeArea = false;
        // Check if the click target is the iframe itself or inside its container div
        if (event.target === iframe || (websiteContainer && websiteContainer.contains(event.target))) {
             clickedOnIframeArea = true;
        }

        // If clicked outside the iframe area AND currently zoomed in, trigger zoom out
        if (!clickedOnIframeArea && zoomTargetZ !== initialCameraPos.z) {
            zoomTargetZ = initialCameraPos.z; // Target the initial camera distance
            isMouseOverIframe = false; // Ensure hover state is reset
            targetX = 0; // Reset rotation targets
            targetY = 0;
            // Target FOV and Y position will automatically adjust back towards initial values in the animate loop
        }
    }
}

// --- Initial Setup ---
animate(); // Start the animation loop for Scene 1
triggerOverheadFlicker(); // Start the random flicker scheduling
resetInactivityTimer(); // Start the inactivity timer when the script loads

console.log("Main script setup complete. Scene 1 animation started. Inactivity timer started.");