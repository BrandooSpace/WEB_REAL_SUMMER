import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Scene 2 Variables ---
let scene2, camera2, renderer2;
let animationFrameId2 = null;
const clock = new THREE.Clock(); // Clock for delta time

// --- FPV Control Variables ---
let isPointerLocked = false;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const sensitivity = 0.002;
const minPolarAngle = 0; // Radians
const maxPolarAngle = Math.PI; // Radians
let fpvHudIndicatorElement = null;
let fpvHudTimeoutId = null;

// --- WASD Movement Variables ---
const moveSpeed = 5.0; // Units per second
const direction = new THREE.Vector3(); // Reusable vector for input direction
const velocity = new THREE.Vector3(); // Reusable vector for velocity calculation
const worldDirection = new THREE.Vector3(); // Reusable vector for camera's world direction
const rightDirection = new THREE.Vector3(); // Reusable vector for camera's right direction
let moveForward = false;
let moveBackward = false;
let moveLeft = false;  // Triggered by 'D' (User edit confirmed)
let moveRight = false; // Triggered by 'A' (User edit confirmed)


// --- HUD Popup Variables ---
let adPopupHudElement = null;
let adPopupFrameElement = null;
let adPopupTimeoutId = null;
let isAdPopupVisible = false;
const AD_POPUP_DELAY = 5000; // Confirmed value
let adPopupShowCount = 0;

let subPopupHudElement = null;
let subPopupFrameElement = null;
let isSubPopupVisible = false;

let cardEntryPopupHudElement = null;
let cardEntryFrameElement = null;
let isCardEntryPopupVisible = false;

let apparelAdPopupHudElement = null;
let apparelAdFrameElement = null;
let apparelAdPopupTimeoutId = null;
let isApparelAdVisible = false;
const APPAREL_AD_DELAY_AFTER_PAYMENT = 3000;

// --- NEW: Random Popup Barrage Variables ---
let randomPopupContainerElement = null;
let randomPopupTimeoutId = null; // Timer for the barrage itself
const RANDOM_POPUP_COUNT = 15; // Number of popups to spawn
const RANDOM_POPUP_DURATION = 3000; // How long the barrage lasts (ms)
let activeRandomPopups = []; // Keep track of spawned popups

// --- NEW: Integration Complete Popup Variables ---
let integrationCompletePopupHudElement = null;
let integrationCompleteFrameElement = null;
let isIntegrationCompletePopupVisible = false;


// --- Main HUD Taskbar Variables ---
let mainHudContainerElement = null;
let mainHudFrameElement = null;

// --- Environment Map Brightening Variables ---
let isBrighteningEnvMap = false;
let envMapBrightenStartTime = 0;
const envMapBrightenDuration = 4000;
const initialEnvMapIntensity = 0.0;
const targetEnvMapIntensity = 1.0;
const initialBackgroundIntensity = 0.0;
const targetBackgroundIntensity = 1.0;

// --- BigInside Model Movement Variables ---
let bigInsideModelRef = null;
let isMovingBigInside = false;
let bigInsideMoveStartTime = 0;
const bigInsideMoveDuration = 2000;
let bigInsideStartY = 0;
const bigInsideTargetY = -1500; // Confirmed value (User edit)
let bigInsideEmissiveApplied = false; // Flag to ensure emissive is applied only once


/**
 * Initializes the second scene (loading WORLD.glb and biginside.gltf) with FPV controls.
 * @param {HTMLElement} container - The DOM element to append the renderer to.
 * @returns {Promise<void>} A promise that resolves when the GLTF models are loaded or rejects on error.
 */
export function initWorldScene(container) {
    return new Promise((resolve, reject) => {
        console.log("Initializing World Scene (Loading WORLD.glb & biginside.gltf) with FPV Controls...");

        try {
            // --- Scene Setup ---
            scene2 = new THREE.Scene();
            scene2.background = new THREE.Color(0x000000); // Start black

            // --- Environment Map Setup ---
            const cubeLoader = new THREE.CubeTextureLoader();
            cubeLoader.setPath('/envmap/'); // ** Ensure path is correct **
            const texture = cubeLoader.load([
                'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
            ],
            () => { // onLoad
                console.log("DEBUG: Environment map loaded successfully.");
                scene2.background = texture;
                scene2.environment = texture;
                scene2.environmentIntensity = initialEnvMapIntensity;
                if (scene2.hasOwnProperty('backgroundIntensity')) {
                    scene2.backgroundIntensity = initialBackgroundIntensity;
                }
                console.log(`DEBUG: Initial env/bg Intensity set`);
            },
            undefined, // onProgress
            (error) => { // onError
                console.error("DEBUG: Failed to load environment map:", error);
                scene2.background = new THREE.Color(0x111111); // Dark fallback
                scene2.environmentIntensity = initialEnvMapIntensity;
                 if (scene2.hasOwnProperty('backgroundIntensity')) {
                    scene2.backgroundIntensity = initialBackgroundIntensity;
                 }
            });

            // --- Camera Setup ---
             // *** INCREASED FAR PLANE HERE ***
            camera2 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000); // Increased far plane from 1000 to 20000
            const initialPos = new THREE.Vector3(0, 1.6, 10); // Player height approx 1.6 units
            camera2.position.copy(initialPos);
            camera2.rotation.set(0, 0, 0);
            euler.setFromQuaternion(camera2.quaternion);
            console.log("DEBUG: Camera initialized at", camera2.position, "with far plane:", camera2.far);

            // --- WebGL Renderer Setup ---
            renderer2 = new THREE.WebGLRenderer({ antialias: true });
            renderer2.setSize(window.innerWidth, window.innerHeight);
            renderer2.outputColorSpace = THREE.SRGBColorSpace;
            renderer2.toneMapping = THREE.ACESFilmicToneMapping;
            renderer2.toneMappingExposure = 1.0;
            renderer2.shadowMap.enabled = true;
            renderer2.shadowMap.type = THREE.PCFSoftShadowMap;

            if (!container || !(container instanceof HTMLElement)) {
                 console.error("DEBUG: Invalid container passed to initWorldScene!");
                 reject(new Error("Invalid container for renderer."));
                 return;
            }
            container.appendChild(renderer2.domElement);
            renderer2.domElement.id = 'scene2-canvas';

            // --- Lighting Setup ---
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
            hemiLight.position.set(0, 50, 0);
            scene2.add(hemiLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
            dirLight.position.set(10, 20, 15);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 100; // Shadow camera far can be smaller than main camera far
            dirLight.shadow.camera.left = -20; dirLight.shadow.camera.right = 20;
            dirLight.shadow.camera.top = 20; dirLight.shadow.camera.bottom = -20;
            scene2.add(dirLight);
            scene2.add(dirLight.target);
            console.log("DEBUG: Scene lighting added.");

            // --- FPV Controls & Movement Setup ---
            renderer2.domElement.addEventListener('click', requestPointerLock);
            document.addEventListener('pointerlockchange', onPointerLockChange, false);
            document.addEventListener('pointerlockerror', onPointerLockError, false);
            document.addEventListener('mousemove', onMouseMove, false);
            document.addEventListener('keydown', onKeyDown, false);
            document.addEventListener('keyup', onKeyUp, false);
            console.log("DEBUG: FPV Controls & Movement Listeners initialized.");

            // --- Get HUD Element References ---
            adPopupHudElement = document.getElementById('adPopupHud');
            adPopupFrameElement = document.getElementById('adPopupFrame');
            subPopupHudElement = document.getElementById('subPopupHud');
            subPopupFrameElement = document.getElementById('subPopupFrame');
            cardEntryPopupHudElement = document.getElementById('cardEntryPopupHud');
            cardEntryFrameElement = document.getElementById('cardEntryFrame');
            fpvHudIndicatorElement = document.getElementById('fpvHudIndicator');
            mainHudContainerElement = document.getElementById('mainHudContainer');
            mainHudFrameElement = document.getElementById('mainHudFrame');
            apparelAdPopupHudElement = document.getElementById('apparelAdPopupHud');
            apparelAdFrameElement = document.getElementById('apparelAdFrame');
            // NEW: Get references for random and final popups
            randomPopupContainerElement = document.getElementById('randomPopupContainer');
            integrationCompletePopupHudElement = document.getElementById('integrationCompletePopupHud');
            integrationCompleteFrameElement = document.getElementById('integrationCompleteFrame');


            // --- Delay FPV HUD appearance ---
            if (fpvHudIndicatorElement) {
                if (fpvHudTimeoutId) clearTimeout(fpvHudTimeoutId);
                const LOADER_ANIMATION_DURATION = 8000; // Delay appearance until after loader likely finishes
                fpvHudTimeoutId = setTimeout(() => {
                    if (fpvHudIndicatorElement) {
                        fpvHudIndicatorElement.textContent = isPointerLocked ? "Press Esc to show cursor" : "Click to move camera";
                        fpvHudIndicatorElement.style.display = 'block';
                    }
                    fpvHudTimeoutId = null;
                }, LOADER_ANIMATION_DURATION);
            } else { console.warn("FPV HUD Indicator element not found!"); }

            // --- Show and load Main HUD Taskbar ---
            if (mainHudContainerElement && mainHudFrameElement) {
                mainHudFrameElement.src = 'HUD.html'; // Load the taskbar content
                mainHudContainerElement.style.display = 'block';
            } else { console.warn("Main HUD Taskbar elements not found!"); }

            // --- Setup Message Listener ---
            window.addEventListener('message', handleWorldSceneMessages);
            console.log("DEBUG: Added message listener for world scene.");

            // --- GLTF Loader ---
            const loader = new GLTFLoader();
            let worldLoaded = false;
            let bigInsideLoaded = false;
            bigInsideEmissiveApplied = false; // Reset flag on init

            const checkAndResolve = () => {
                if (worldLoaded && bigInsideLoaded) {
                    console.log("DEBUG: Both models loaded. Resolving initWorldScene Promise.");
                    startWorldSceneAnimation();
                    adPopupShowCount = 0;
                    if (adPopupTimeoutId) clearTimeout(adPopupTimeoutId);
                    adPopupTimeoutId = setTimeout(showAdPopup, AD_POPUP_DELAY); // Schedule first hudpopup ad
                    resolve();
                }
            };

            // Load WORLD.glb
            loader.load( '/WORLD.glb', (gltf) => { // ** Ensure path is correct **
                    const worldModel = gltf.scene;
                    worldModel.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true; node.receiveShadow = true;
                            if (node.material) node.material.envMapIntensity = targetEnvMapIntensity;
                        }
                    });
                    scene2.add(worldModel);
                    worldLoaded = true;
                    checkAndResolve();
                },
                (xhr) => console.log(`WORLD.glb ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`),
                (error) => {
                    console.error('Error loading WORLD.glb:', error);
                    reject(new Error('Failed to load WORLD.glb'));
                }
            );

            // Load biginside.gltf
            loader.load( '/biginside.gltf', (gltf) => { // ** Ensure path is correct **
                    bigInsideModelRef = gltf.scene;
                    console.log("biginside.gltf loaded successfully!");
                    bigInsideModelRef.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true; node.receiveShadow = true;
                            if (node.material) {
                                node.material.envMapIntensity = targetEnvMapIntensity; // Set envMapIntensity
                            }
                        }
                    });
                    bigInsideStartY = bigInsideModelRef.position.y;
                    console.log(`DEBUG: Stored initial bigInside Y position: ${bigInsideStartY}`);
                    scene2.add(bigInsideModelRef);
                    bigInsideLoaded = true;
                    checkAndResolve();
                },
                (xhr) => console.log(`biginside.gltf ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`),
                (error) => {
                    console.error('Error loading biginside.gltf:', error);
                    console.warn("DEBUG: Failed to load biginside.gltf, but continuing...");
                    bigInsideLoaded = true; // Mark as handled
                    checkAndResolve();
                }
            );

            // --- Resize Handler for Scene 2 ---
            window.addEventListener('resize', onWindowResizeScene2, false);

        } catch (setupError) {
             console.error("--- Error during world scene initialization: ---", setupError);
             reject(setupError);
        }

    });
}


// --- Resize Handler ---
function onWindowResizeScene2() {
    if (!camera2 || !renderer2) return;
    camera2.aspect = window.innerWidth / window.innerHeight;
    camera2.updateProjectionMatrix();
    renderer2.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animateWorldScene() {
    animationFrameId2 = requestAnimationFrame(animateWorldScene);
    const delta = clock.getDelta(); // Get time elapsed since last frame

    // *** Environment Map Brightening Logic ***
    if (isBrighteningEnvMap && scene2) {
        const elapsedTime = Date.now() - envMapBrightenStartTime;
        const progress = Math.min(elapsedTime / envMapBrightenDuration, 1.0);
        scene2.environmentIntensity = THREE.MathUtils.lerp(initialEnvMapIntensity, targetEnvMapIntensity, progress);
        if (scene2.hasOwnProperty('backgroundIntensity')) {
             scene2.backgroundIntensity = THREE.MathUtils.lerp(initialBackgroundIntensity, targetBackgroundIntensity, progress);
        }
        if (progress >= 1.0) {
            isBrighteningEnvMap = false;
            scene2.environmentIntensity = targetEnvMapIntensity;
            if (scene2.hasOwnProperty('backgroundIntensity')) {
                 scene2.backgroundIntensity = targetBackgroundIntensity;
             }
        }
    }

    // *** BigInside Model Movement Logic ***
    if (isMovingBigInside && bigInsideModelRef) {
        const elapsedTime = Date.now() - bigInsideMoveStartTime;
        const progress = Math.min(elapsedTime / bigInsideMoveDuration, 1.0);
        const newY = THREE.MathUtils.lerp(bigInsideStartY, bigInsideTargetY, progress);
        bigInsideModelRef.position.y = newY;

        // --- Check if animation is complete ---
        if (progress >= 1.0) {
            isMovingBigInside = false; // Stop the movement animation
            console.log(`DEBUG: bigInside model movement complete. Final Y: ${bigInsideModelRef.position.y}`);

            // --- Apply Emissive Properties *AFTER* animation completes ---
            if (!bigInsideEmissiveApplied) { // Check the flag
                console.log("DEBUG: Applying emissive properties to bigInside model now.");
                bigInsideModelRef.traverse((node) => {
                    if (node.isMesh && node.material) {
                        if (node.material.isMeshStandardMaterial || node.material.isMeshPhysicalMaterial) {
                            // Set the emissive color (R:215, G:255, B:194)
                            node.material.emissive = new THREE.Color(215 / 255, 255 / 255, 194 / 255);
                            // Set the NEW emissive intensity
                            node.material.emissiveIntensity = 0.45; // Updated intensity
                            node.material.needsUpdate = true;
                             console.log(`DEBUG: Set emissive properties for mesh: ${node.name || 'Unnamed'}`);
                        } else {
                             console.log(`DEBUG: Material for mesh ${node.name || 'Unnamed'} is not Standard or Physical, skipping emissive.`);
                        }
                    }
                });
                bigInsideEmissiveApplied = true; // Set the flag so it doesn't run again
            }
        }
    }

    // *** WASD Movement Logic (XZ Plane) ***
    if (isPointerLocked && camera2) {
        velocity.set(0, 0, 0); // Reset velocity for this frame

        // 1. Calculate input direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft); // A=Right, D=Left (User edit confirmed)
        direction.normalize();

        // 2. Get camera's world direction projected onto XZ plane
        camera2.getWorldDirection(worldDirection);
        worldDirection.y = 0;
        worldDirection.normalize();

        // 3. Calculate the right direction vector projected onto XZ plane
        rightDirection.crossVectors(camera2.up, worldDirection).normalize();

        // 4. Calculate velocity based on input and directions
        if (moveForward || moveBackward) {
            velocity.addScaledVector(worldDirection, direction.z * moveSpeed * delta);
        }
        if (moveLeft || moveRight) {
            // Apply velocity along the calculated right/left direction
            velocity.addScaledVector(rightDirection, -direction.x * moveSpeed * delta); // Negate direction.x because A=Right(+x input), D=Left(-x input)
        }

        // 5. Apply the calculated velocity to the camera's position
        camera2.position.add(velocity);

    }


    // Render the scene if components are ready
    if (renderer2 && scene2 && camera2) {
        try {
            renderer2.render(scene2, camera2);
        }
        catch (renderError) {
             console.error("--- Error during scene 2 render: ---", renderError);
             if (animationFrameId2) cancelAnimationFrame(animationFrameId2);
             animationFrameId2 = null;
        }
    }
}

// --- Function to Start the Animation Loop ---
export function startWorldSceneAnimation() {
    if (animationFrameId2) cancelAnimationFrame(animationFrameId2);
    clock.start(); // Start the clock when animation starts
    animateWorldScene();
}

// --- FPV Control Event Handlers ---
function requestPointerLock() {
    if (renderer2 && renderer2.domElement) renderer2.domElement.requestPointerLock();
}
function onPointerLockChange() {
    isPointerLocked = (document.pointerLockElement === renderer2.domElement);
    if (fpvHudIndicatorElement && fpvHudIndicatorElement.style.display === 'block') {
        fpvHudIndicatorElement.textContent = isPointerLocked ? "Press Esc to show cursor" : "Click to move camera";
    }
}
function onPointerLockError() {
    console.error('Pointer Lock Error'); isPointerLocked = false;
    if (fpvHudIndicatorElement && fpvHudIndicatorElement.style.display === 'block') {
        fpvHudIndicatorElement.textContent = "Click to move camera";
    }
}
function onMouseMove(event) {
    if (!isPointerLocked || !camera2) return;
    const movementX = event.movementX || 0; const movementY = event.movementY || 0;
    euler.y -= movementX * sensitivity; euler.x -= movementY * sensitivity;
    euler.x = Math.max(Math.PI / 2 - maxPolarAngle, Math.min(Math.PI / 2 - minPolarAngle, euler.x));
    camera2.quaternion.setFromEuler(euler);
}

// *** Key Down/Up Handlers for Movement (A/D Swapped by user) ***
function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break; // A = Right
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break; // D = Left
    }
}
function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break; // A = Right
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break; // D = Left
    }
}


// --- HUD Ad Popup Functions ---
function showAdPopup() {
    if (!adPopupHudElement || !adPopupFrameElement || isAdPopupVisible) return;
    adPopupShowCount++;
    let popupUrl = 'hudpopup.html'; // ** Ensure hudpopup.html exists **
    if (adPopupShowCount === 2) popupUrl += '?appearance=second';
    adPopupFrameElement.src = popupUrl;
    adPopupHudElement.style.display = 'block';
    isAdPopupVisible = true;
    if (adPopupTimeoutId) clearTimeout(adPopupTimeoutId); adPopupTimeoutId = null;
}
function hideAdPopup(scheduleRespawn = false) {
    if (!adPopupHudElement || !adPopupFrameElement || !isAdPopupVisible) return;
    adPopupHudElement.style.display = 'none'; adPopupFrameElement.src = 'about:blank';
    isAdPopupVisible = false;
    if (adPopupTimeoutId) clearTimeout(adPopupTimeoutId); adPopupTimeoutId = null;
    if (scheduleRespawn && adPopupShowCount < 2) {
        const respawnDelay = 5000;
        adPopupTimeoutId = setTimeout(showAdPopup, respawnDelay);
    }
}

// --- Subscription Popup Functions ---
function showSubscriptionPopup() {
    if (!subPopupHudElement || !subPopupFrameElement || isSubPopupVisible) return;
    subPopupFrameElement.src = 'sub.html'; // ** Ensure sub.html exists **
    subPopupHudElement.style.display = 'block'; isSubPopupVisible = true;
}
function hideSubscriptionPopup() {
    if (!subPopupHudElement || !subPopupFrameElement || !isSubPopupVisible) return;
    subPopupHudElement.style.display = 'none'; subPopupFrameElement.src = 'about:blank';
    isSubPopupVisible = false;
}

// --- Card Entry Popup Functions ---
function showCardEntryPopup() {
    if (!cardEntryPopupHudElement || !cardEntryFrameElement || isCardEntryPopupVisible) return;
    cardEntryFrameElement.src = 'card_entry.html'; // ** Ensure card_entry.html exists **
    cardEntryPopupHudElement.style.display = 'block'; isCardEntryPopupVisible = true;
}
function hideCardEntryPopup() {
    if (!cardEntryPopupHudElement || !cardEntryFrameElement || !isCardEntryPopupVisible) return;
    cardEntryPopupHudElement.style.display = 'none'; cardEntryFrameElement.src = 'about:blank';
    isCardEntryPopupVisible = false;
}

// --- Apparel Ad Popup Functions ---
function showApparelAdPopup() {
    if (!apparelAdPopupHudElement || !apparelAdFrameElement || isApparelAdVisible) {
        console.log("DEBUG: Skipping showApparelAdPopup (not found or already visible).");
        return;
    }
    console.log("DEBUG: Showing apparel_popup_ad.html");
    apparelAdFrameElement.src = 'apparel_popup_ad.html'; // Load the ad content
    apparelAdPopupHudElement.style.display = 'block';
    isApparelAdVisible = true;
     if (apparelAdPopupTimeoutId) clearTimeout(apparelAdPopupTimeoutId);
     apparelAdPopupTimeoutId = null;
}
function hideApparelAdPopup() {
    if (!apparelAdPopupHudElement || !apparelAdFrameElement || !isApparelAdVisible) return;
    console.log("DEBUG: Hiding apparel_popup_ad.html");
    apparelAdPopupHudElement.style.display = 'none';
    apparelAdFrameElement.src = 'about:blank';
    isApparelAdVisible = false;
    if (apparelAdPopupTimeoutId) clearTimeout(apparelAdPopupTimeoutId);
    apparelAdPopupTimeoutId = null;
}

// --- NEW: Random Popup Barrage Functions ---
/**
 * Spawns multiple instances of random_popup.html at random positions.
 */
function startPopupBarrage() {
    if (!randomPopupContainerElement) {
        console.error("Random popup container not found!");
        return;
    }
    console.log("Starting popup barrage...");
    // Clear any previous random popups
    clearPopupBarrage();

    for (let i = 0; i < RANDOM_POPUP_COUNT; i++) {
        const popupDiv = document.createElement('div');
        popupDiv.className = 'random-popup w98-border-raised'; // Apply base styles
        popupDiv.style.left = `${Math.random() * (window.innerWidth - 280)}px`; // Random X (within bounds)
        popupDiv.style.top = `${Math.random() * (window.innerHeight - 180)}px`; // Random Y (within bounds)

        const iframe = document.createElement('iframe');
        iframe.src = 'random_popup.html'; // Source for the popup content
        // Prevent interaction with barrage popups
        iframe.style.pointerEvents = 'none';

        popupDiv.appendChild(iframe);
        randomPopupContainerElement.appendChild(popupDiv);
        activeRandomPopups.push(popupDiv); // Keep track
    }

    // Set a timer to clear the barrage after a duration
    if (randomPopupTimeoutId) clearTimeout(randomPopupTimeoutId);
    randomPopupTimeoutId = setTimeout(clearPopupBarrage, RANDOM_POPUP_DURATION);
}

/**
 * Removes all currently displayed random popups.
 */
function clearPopupBarrage() {
    console.log("Clearing popup barrage...");
    if (randomPopupTimeoutId) {
        clearTimeout(randomPopupTimeoutId);
        randomPopupTimeoutId = null;
    }
    activeRandomPopups.forEach(popup => {
        if (popup.parentNode) {
             // Optional: Fade out before removing
             popup.classList.add('hiding');
             setTimeout(() => popup.parentNode.removeChild(popup), 500); // Remove after fade
        }
    });
    activeRandomPopups = []; // Clear the tracking array
}

// --- NEW: Integration Complete Popup Functions ---
/**
 * Shows the final "Integration Complete" popup.
 */
function showIntegrationCompletePopup() {
     if (!integrationCompletePopupHudElement || !integrationCompleteFrameElement || isIntegrationCompletePopupVisible) {
          console.warn("Cannot show Integration Complete popup (not found or already visible)");
          // As a fallback, force reload if the popup can't be shown
          setTimeout(() => window.top.location.reload(), 1000);
          return;
     }
     console.log("Showing Integration Complete popup.");
     integrationCompleteFrameElement.src = 'integration_complete.html';
     integrationCompletePopupHudElement.style.display = 'block';
     isIntegrationCompletePopupVisible = true;
     // The script inside integration_complete.html will handle the final reload.
}

/**
 * Hides the "Integration Complete" popup (optional, as it triggers reload).
 */
function hideIntegrationCompletePopup() {
     if (!integrationCompletePopupHudElement || !integrationCompleteFrameElement || !isIntegrationCompletePopupVisible) return;
     integrationCompletePopupHudElement.style.display = 'none';
     integrationCompleteFrameElement.src = 'about:blank';
     isIntegrationCompletePopupVisible = false;
}


// --- Message Handler function ---
function handleWorldSceneMessages(event) {
    if (!event.data || !event.data.type || !scene2) return;
    console.log(`WorldScene received message: ${event.data.type}`);

    switch (event.data.type) {
        case 'closeAdPopup': // Handles hudpopup.html
            if (isAdPopupVisible) hideAdPopup(true);
            break;
        case 'closeApparelAdPopup': // Handles apparel_popup_ad.html
            if (isApparelAdVisible) hideApparelAdPopup();
            break;
        case 'loadSubscriptionPage': // From hudpopup.html
            showSubscriptionPopup();
            hideAdPopup(false);
            break;
        case 'loadCardEntryPage': // From sub.html
            showCardEntryPopup();
            hideSubscriptionPopup();
            break;
        case 'closeSubscriptionPopup': // Should not normally happen without proceeding
            if (isSubPopupVisible) hideSubscriptionPopup();
            break;
        // --- MODIFIED: closeCardEntryPopup handler ---
        case 'closeCardEntryPopup':
            if (isCardEntryPopupVisible) {
                hideCardEntryPopup();

                // Trigger existing animations (env brightening, bigInside movement)
                if (!isBrighteningEnvMap) {
                    isBrighteningEnvMap = true;
                    envMapBrightenStartTime = Date.now();
                }
                if (!isMovingBigInside && bigInsideModelRef) {
                    bigInsideStartY = bigInsideModelRef.position.y;
                    isMovingBigInside = true;
                    bigInsideMoveStartTime = Date.now();
                    bigInsideEmissiveApplied = false;
                } else if (!bigInsideModelRef) {
                    console.warn("Cannot start bigInside movement: model ref missing.");
                }

                // --- NEW Sequence: 10s delay -> Barrage -> Cleanup -> Final Popup ---
                console.log("Payment confirmed. Starting 10 second delay before final sequence...");
                setTimeout(() => {
                    console.log("10s delay finished. Starting popup barrage.");
                    startPopupBarrage(); // Start the barrage

                    // Set timeout for barrage duration before cleanup and final popup
                    setTimeout(() => {
                        console.log("Popup barrage duration finished. Cleaning up scene...");
                        // Cleanup scene happens *before* showing final popup
                        cleanupWorldScene();
                        console.log("Showing Integration Complete popup...");
                        // Need to access document directly as scene/renderer are gone
                        showIntegrationCompletePopup();
                    }, RANDOM_POPUP_DURATION); // Wait for barrage to finish

                }, 10000); // 10 second delay
            }
            break;
        // --- End MODIFICATION ---
        default: break;
    }
}


// Cleanup function for scene 2
export function cleanupWorldScene() {
    console.log("--- Cleaning up World Scene ---");
    if (animationFrameId2) cancelAnimationFrame(animationFrameId2);
    animationFrameId2 = null;
    clock.stop(); // Stop the clock
    window.removeEventListener('resize', onWindowResizeScene2);

    // Cleanup popups, timers, HUDs
    if (adPopupTimeoutId) clearTimeout(adPopupTimeoutId);
    if (fpvHudTimeoutId) clearTimeout(fpvHudTimeoutId);
    if (apparelAdPopupTimeoutId) clearTimeout(apparelAdPopupTimeoutId);
    if (randomPopupTimeoutId) clearTimeout(randomPopupTimeoutId); // Clear barrage timer
    hideAdPopup(false); hideSubscriptionPopup(); hideCardEntryPopup(); hideApparelAdPopup();
    hideIntegrationCompletePopup(); // Hide final popup if somehow still visible
    clearPopupBarrage(); // Ensure any remaining random popups are cleared

    if (fpvHudIndicatorElement) fpvHudIndicatorElement.style.display = 'none';
    if (mainHudContainerElement) mainHudContainerElement.style.display = 'none';
    if (mainHudFrameElement) mainHudFrameElement.src = 'about:blank';

    // Reset state variables
    adPopupHudElement = null; adPopupFrameElement = null; adPopupShowCount = 0; adPopupTimeoutId = null; isAdPopupVisible = false;
    subPopupHudElement = null; subPopupFrameElement = null; isSubPopupVisible = false;
    cardEntryPopupHudElement = null; cardEntryFrameElement = null; isCardEntryPopupVisible = false;
    fpvHudIndicatorElement = null; fpvHudTimeoutId = null;
    mainHudContainerElement = null; mainHudFrameElement = null;
    apparelAdPopupHudElement = null; apparelAdFrameElement = null; apparelAdPopupTimeoutId = null; isApparelAdVisible = false;
    // NEW: Reset random/final popup variables
    randomPopupContainerElement = null; randomPopupTimeoutId = null; activeRandomPopups = [];
    integrationCompletePopupHudElement = null; integrationCompleteFrameElement = null; isIntegrationCompletePopupVisible = false;

    isBrighteningEnvMap = false;
    isMovingBigInside = false;
    bigInsideModelRef = null;
    bigInsideEmissiveApplied = false;
    moveForward = false; moveBackward = false; moveLeft = false; moveRight = false;


    // Remove listeners
    window.removeEventListener('message', handleWorldSceneMessages);
    if (renderer2 && renderer2.domElement) renderer2.domElement.removeEventListener('click', requestPointerLock);
    document.removeEventListener('pointerlockchange', onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', onPointerLockError, false);
    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('keydown', onKeyDown, false);
    document.removeEventListener('keyup', onKeyUp, false);

    if (document.pointerLockElement) document.exitPointerLock();
    isPointerLocked = false;

    // Dispose Scene Resources
    if (scene2) {
         if (scene2.background && scene2.background.isTexture) scene2.background.dispose();
         scene2.environment = null; scene2.background = null;
        scene2.traverse((object) => {
             if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach(m => {
                        for (const key in m) {
                            if (m[key] && m[key].isTexture) {
                                m[key].dispose();
                            }
                        }
                        m.dispose();
                    });
                }
            }
            if (object.isLight && object.shadow && object.shadow.map) object.shadow.map.dispose();
        });
         while(scene2.children.length > 0){
            scene2.remove(scene2.children[0]);
         }
        scene2 = null;
    }
     if (renderer2) {
        renderer2.dispose(); renderer2.forceContextLoss();
        if (renderer2.domElement && renderer2.domElement.parentNode) renderer2.domElement.parentNode.removeChild(renderer2.domElement);
        renderer2 = null;
    }
    camera2 = null;
    console.log("--- World Scene cleanup complete ---");
}