/**
 * StylePulse — High-Precision 60/120FPS Extended Timeline Video Engine
 * Features:
 * - Extended 5100px scroll track for ultra-smooth high-precision video scrubbing.
 * - Automatic scroll restoration reset to top (0,0) on every page reload.
 * - Adaptive kinetic LERP physics for zero-drag responsiveness.
 * - Pre-rendered initial hero frame & under 3-second initialization.
 */

(function () {
    // 1. Force Page Reload to Always Start at Hero Section (0,0)
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    window.addEventListener('DOMContentLoaded', () => {
        window.scrollTo(0, 0);

        // DOM Elements
        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        
        const loader = document.getElementById('loader');
        const progressBar = document.getElementById('progress-bar');
        const loaderStatus = document.getElementById('loader-status');
        const loaderPercent = document.getElementById('loader-percent');

        // Extended Timeline Scroll Configuration (5100px Total Extended Range for Maximum Smoothness)
        const MAX_SCROLL = 5100;
        const V1_SCROLL_END = 1600;      // Video 1 plays continuously from 0px to 1600px
        const V2_SCROLL_START = 1600;    // Video 2 continues motion seamlessly from 1600px to 3200px
        const V2_SCROLL_END = 3200;
        const V3_SCROLL_START = 3200;    // Video 3 continues motion seamlessly from 3200px to 4800px
        const V3_SCROLL_END = 4800;

        // Card Overlays Timeline Bounds
        const OVERLAY1_FADE_IN_START = 1350;
        const OVERLAY1_FADE_IN_END = 1600;
        const OVERLAY1_FADE_OUT_START = 1600;
        const OVERLAY1_FADE_OUT_END = 1850;
        const MAGNETIC_TARGET_1 = 1600;

        const OVERLAY2_FADE_IN_START = 2950;
        const OVERLAY2_FADE_IN_END = 3200;
        const OVERLAY2_FADE_OUT_START = 3200;
        const OVERLAY2_FADE_OUT_END = 3450;
        const MAGNETIC_TARGET_2 = 3200;

        const OVERLAY3_FADE_IN_START = 4650;
        const OVERLAY3_FADE_IN_END = 4800;
        const MAGNETIC_TARGET_3 = 4800;
        const MAGNETIC_RANGE = 120;

        let magneticTimeout = null;
        let isMagneticActive = false;

        // High-Speed Extraction Settings (<3 Seconds Loading)
        const FPS = 15;
        const frameStep = 1 / FPS;

        // State Variables for Kinetic LERP Smooth Scroll Engine
        const frames1 = [];
        const frames2 = [];
        const frames3 = [];
        let targetScrollProgress = 0;
        let currentScrollProgress = 0;
        let isInitialized = false;

        // Cached Canvas Dimensions to eliminate layout thrashing
        let cachedCanvasWidth = 0;
        let cachedCanvasHeight = 0;
        let lastRenderedFrame = null;

        // Lock scroll during preloader extraction
        document.body.classList.add('loading');

        // Progress Helper
        let currentOverallPct = 0;
        function setLoaderProgress(pct, statusText) {
            currentOverallPct = Math.max(currentOverallPct, Math.min(100, Math.round(pct)));
            if (progressBar) progressBar.style.width = `${currentOverallPct}%`;
            if (loaderPercent) loaderPercent.innerText = `${currentOverallPct}%`;
            if (loaderStatus && statusText) loaderStatus.innerText = statusText;
        }

        // Canvas DPR Resizer
        function updateCanvasSize() {
            const dpr = window.devicePixelRatio || 1;
            cachedCanvasWidth = window.innerWidth * dpr;
            cachedCanvasHeight = window.innerHeight * dpr;
            canvas.width = cachedCanvasWidth;
            canvas.height = cachedCanvasHeight;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            drawCurrentFrame(true);
        }

        window.addEventListener('resize', updateCanvasSize, { passive: true });
        updateCanvasSize();

        // 1. Fast Parallel Triple-Video Preloader & Decoder Pipeline (<3 Seconds)
        async function initTripleVideoEngine() {
            try {
                setLoaderProgress(15, 'Loading video streams in parallel...');

                let prog1 = 0, prog2 = 0, prog3 = 0;
                const updateFetchProg = () => {
                    const avg = (prog1 + prog2 + prog3) / 3;
                    setLoaderProgress(15 + Math.round(avg * 35), 'Loading video streams in parallel...');
                };

                const [blob1, blob2, blob3] = await Promise.all([
                    fetchBlob('component/landing_page.mp4', (p) => { prog1 = p; updateFetchProg(); }),
                    fetchBlob('component/02.mp4', (p) => { prog2 = p; updateFetchProg(); }),
                    fetchBlob('component/03.mp4', (p) => { prog3 = p; updateFetchProg(); })
                ]);

                setLoaderProgress(50, 'Decoding frames in parallel...');

                const url1 = URL.createObjectURL(blob1);
                const url2 = URL.createObjectURL(blob2);
                const url3 = URL.createObjectURL(blob3);

                await Promise.all([
                    extractVideoFrames(url1, frames1, 50, 70, 'Video 1', true),
                    extractVideoFrames(url2, frames2, 70, 85, 'Video 2', false),
                    extractVideoFrames(url3, frames3, 85, 100, 'Video 3', false)
                ]);

                isInitialized = true;
                setLoaderProgress(100, 'Ready!');

                setTimeout(completeInitialization, 100);
            } catch (err) {
                console.error('Fast triple video init error:', err);
                completeInitialization();
            }
        }

        function fetchBlob(url, onProgress) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                xhr.onprogress = (e) => {
                    if (e.lengthComputable && onProgress) {
                        onProgress(e.loaded / e.total);
                    }
                };
                xhr.onload = () => {
                    if (xhr.status === 200) resolve(xhr.response);
                    else reject(new Error(`HTTP ${xhr.status} loading ${url}`));
                };
                xhr.onerror = () => reject(new Error(`Network error loading ${url}`));
                xhr.send();
            });
        }

        function extractVideoFrames(blobUrl, targetArray, startPct, endPct, label, isFirstVideo = false) {
            return new Promise((resolve) => {
                const tempVideo = document.createElement('video');
                tempVideo.src = blobUrl;
                tempVideo.muted = true;
                tempVideo.playsInline = true;

                const safetyTimeout = setTimeout(() => {
                    tempVideo.remove();
                    resolve();
                }, 6000);

                tempVideo.addEventListener('loadedmetadata', () => {
                    const duration = tempVideo.duration;
                    const totalFrames = Math.ceil(duration / frameStep);
                    targetArray.length = totalFrames;

                    const vw = tempVideo.videoWidth || 1280;
                    const vh = tempVideo.videoHeight || 720;
                    const aspect = vw / vh;
                    
                    const isMobile = window.innerWidth <= 768;
                    const captureWidth = isMobile ? 960 : 1440;
                    const captureHeight = Math.round(captureWidth / aspect);

                    const numWorkers = 4;
                    const segmentDuration = duration / numWorkers;
                    let completedWorkers = 0;

                    for (let k = 0; k < numWorkers; k++) {
                        const v = document.createElement('video');
                        v.src = blobUrl;
                        v.muted = true;
                        v.playsInline = true;

                        const startLimit = k * segmentDuration;
                        const endLimit = (k + 1) * segmentDuration;
                        let currentTime = startLimit;

                        const offscreenCanvas = document.createElement('canvas');
                        offscreenCanvas.width = captureWidth;
                        offscreenCanvas.height = captureHeight;
                        const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });

                        v.addEventListener('seeked', async function capture() {
                            offscreenCtx.drawImage(v, 0, 0, captureWidth, captureHeight);
                            try {
                                const bitmap = await createImageBitmap(offscreenCanvas, { resizeQuality: 'medium' });
                                const index = Math.min(totalFrames - 1, Math.floor(currentTime / frameStep));
                                targetArray[index] = bitmap;

                                if (isFirstVideo && index === 0) {
                                    drawCurrentFrame(true);
                                }
                            } catch (err) {
                                console.error(`Capture error in ${label}`, err);
                            }

                            const loadedCount = targetArray.filter(Boolean).length;
                            const progressRatio = loadedCount / totalFrames;
                            const currentPct = startPct + Math.round(progressRatio * (endPct - startPct));
                            setLoaderProgress(currentPct, `Processing ${label}...`);

                            currentTime += frameStep;
                            if (currentTime < endLimit && currentTime < duration - 0.08) {
                                v.currentTime = currentTime;
                            } else {
                                v.removeEventListener('seeked', capture);
                                v.remove();
                                completedWorkers++;

                                if (completedWorkers === numWorkers) {
                                    clearTimeout(safetyTimeout);
                                    tempVideo.remove();
                                    resolve();
                                }
                            }
                        });

                        if (v.readyState >= 1) {
                            v.currentTime = startLimit;
                        } else {
                            v.addEventListener('loadedmetadata', () => {
                                v.currentTime = startLimit;
                            });
                        }
                    }
                });
            });
        }

        // Start Preloader
        initTripleVideoEngine();

        // 2. Complete Preloader & Setup Interactive Handlers
        function completeInitialization() {
            document.body.classList.remove('loading');

            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => loader.remove(), 450);
            }

            const header = document.getElementById('main-header');
            const heroContent = document.getElementById('hero-content');
            const endContent = document.getElementById('end-content');
            const endFrame = document.querySelector('.end-frame-wrapper');
            const servicesContent = document.getElementById('services-content');
            const servicesFrame = document.querySelector('.services-frame-wrapper');
            const frame3Content = document.getElementById('frame3-content');
            const frame3Wrapper = document.querySelector('.frame3-wrapper');

            // Interactive Tag Chips for Frame 2 Services HUD
            const tagChips = document.querySelectorAll('.tag-chip');
            const descText = document.getElementById('services-description-text');
            const descContentMap = {
                all: "We offer a comprehensive suite of digital booking features designed to simplify your scheduling needs and elevate your salon experience. Our intelligent platform is dedicated to providing you with seamless appointment management, utilizing real-time availability and secure instant confirmations. Whether you are looking to quickly secure a slot with your preferred stylist or receive automated reminders for your upcoming visit, we have the perfect digital solution to save you time and eliminate hassle. Experience the pinnacle of effortless booking with StylePulse, where your convenience is our top priority.",
                slots: "Real-Time Availability: Access live stylist appointment slots in real-time with zero friction. Guaranteed instant confirmation and dynamic time slot reservation tailored directly to your schedule.",
                stylists: "Preferred Stylists: Browse verified top-rated master stylists, view portfolio showcases, and select your personal favorite professional tailored to your unique hair and grooming preferences.",
                reminders: "Automated Reminders: Never miss an appointment. Receive smart automated notifications, calendar sync updates, and instant status alerts via SMS and email prior to your visit."
            };

            tagChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    tagChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    const key = chip.getAttribute('data-tag');
                    if (descText && descContentMap[key]) {
                        descText.style.opacity = '0';
                        setTimeout(() => {
                            descText.innerText = descContentMap[key];
                            descText.style.opacity = '1';
                        }, 150);
                    }
                });
            });

            // Navbar Navigation Handlers
            const navHome = document.getElementById('nav-home');
            const navAbout = document.getElementById('nav-about');
            const navServices = document.getElementById('nav-services');

            if (navHome) {
                navHome.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
            if (navAbout) {
                navAbout.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.scrollTo({ top: MAGNETIC_TARGET_1, behavior: 'smooth' });
                });
            }
            if (navServices) {
                navServices.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.scrollTo({ top: MAGNETIC_TARGET_2, behavior: 'smooth' });
                });
            }

            // High-Precision Scroll Position Calculator
            const updateTargetScroll = () => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                targetScrollProgress = scrollTop;

                if (header) {
                    if (scrollTop > 10) header.classList.add('scrolled');
                    else header.classList.remove('scrolled');
                }

                // Active Nav Links
                const allNavLinks = document.querySelectorAll('.nav-links .nav-link');
                allNavLinks.forEach(l => l.classList.remove('active'));
                if (scrollTop >= 2400 && navServices) {
                    navServices.classList.add('active');
                } else if (scrollTop >= 800 && navAbout) {
                    navAbout.classList.add('active');
                } else if (navHome) {
                    navHome.classList.add('active');
                }

                // Hero Content Dissolve Animation
                if (heroContent) {
                    const fadeProgress = Math.max(0, 1 - (scrollTop / 320));
                    const shiftLeft = Math.min(320, scrollTop * 1.35);
                    heroContent.style.opacity = fadeProgress;
                    heroContent.style.transform = `translateX(-${shiftLeft}px)`;
                }

                // Frame 1 Overlay Fade (1350px -> 1850px)
                let progress1 = 0;
                if (scrollTop >= OVERLAY1_FADE_IN_START && scrollTop < OVERLAY1_FADE_IN_END) {
                    progress1 = (scrollTop - OVERLAY1_FADE_IN_START) / (OVERLAY1_FADE_IN_END - OVERLAY1_FADE_IN_START);
                } else if (scrollTop >= OVERLAY1_FADE_OUT_START && scrollTop <= OVERLAY1_FADE_OUT_END) {
                    progress1 = 1 - (scrollTop - OVERLAY1_FADE_OUT_START) / (OVERLAY1_FADE_OUT_END - OVERLAY1_FADE_OUT_START);
                }

                if (endContent) endContent.style.pointerEvents = progress1 > 0.5 ? 'auto' : 'none';
                if (endFrame) {
                    endFrame.style.opacity = progress1;
                    endFrame.style.transform = `scale(${0.96 + 0.04 * Math.min(1, progress1)})`;
                }

                // Frame 2 Overlay Fade (2950px -> 3450px)
                let progress2 = 0;
                if (scrollTop >= OVERLAY2_FADE_IN_START && scrollTop < OVERLAY2_FADE_IN_END) {
                    progress2 = (scrollTop - OVERLAY2_FADE_IN_START) / (OVERLAY2_FADE_IN_END - OVERLAY2_FADE_IN_START);
                } else if (scrollTop >= OVERLAY2_FADE_OUT_START && scrollTop <= OVERLAY2_FADE_OUT_END) {
                    progress2 = 1 - (scrollTop - OVERLAY2_FADE_OUT_START) / (OVERLAY2_FADE_OUT_END - OVERLAY2_FADE_OUT_START);
                }

                if (servicesContent) servicesContent.style.pointerEvents = progress2 > 0.5 ? 'auto' : 'none';
                if (servicesFrame) {
                    servicesFrame.style.opacity = progress2;
                    servicesFrame.style.transform = `scale(${0.95 + 0.05 * Math.min(1, progress2)})`;
                }

                // Frame 3 Overlay Fade (4650px -> 4800px)
                let progress3 = 0;
                if (scrollTop >= OVERLAY3_FADE_IN_START) {
                    progress3 = Math.min(1, Math.max(0, (scrollTop - OVERLAY3_FADE_IN_START) / (OVERLAY3_FADE_IN_END - OVERLAY3_FADE_IN_START)));
                }

                if (frame3Content) frame3Content.style.pointerEvents = progress3 > 0.5 ? 'auto' : 'none';
                if (frame3Wrapper) {
                    frame3Wrapper.style.opacity = progress3;
                    frame3Wrapper.style.transform = `scale(${0.94 + 0.06 * Math.min(1, progress3)})`;
                }
            };

            // Magnetic Snap System Configuration
            const triggerMagneticSnap = () => {
                if (isMagneticActive) return;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                const offset1 = scrollTop - MAGNETIC_TARGET_1;
                if (Math.abs(offset1) > 4 && Math.abs(offset1) <= MAGNETIC_RANGE) {
                    isMagneticActive = true;
                    window.scrollTo({ top: MAGNETIC_TARGET_1, behavior: 'smooth' });
                    setTimeout(() => { isMagneticActive = false; }, 450);
                    return;
                }

                const offset2 = scrollTop - MAGNETIC_TARGET_2;
                if (Math.abs(offset2) > 4 && Math.abs(offset2) <= MAGNETIC_RANGE) {
                    isMagneticActive = true;
                    window.scrollTo({ top: MAGNETIC_TARGET_2, behavior: 'smooth' });
                    setTimeout(() => { isMagneticActive = false; }, 450);
                    return;
                }

                const offset3 = scrollTop - MAGNETIC_TARGET_3;
                if (Math.abs(offset3) > 4 && Math.abs(offset3) <= MAGNETIC_RANGE) {
                    isMagneticActive = true;
                    window.scrollTo({ top: MAGNETIC_TARGET_3, behavior: 'smooth' });
                    setTimeout(() => { isMagneticActive = false; }, 450);
                }
            };

            window.addEventListener('scroll', () => {
                updateTargetScroll();
                if (magneticTimeout) clearTimeout(magneticTimeout);
                magneticTimeout = setTimeout(triggerMagneticSnap, 120);
            }, { passive: true });

            updateTargetScroll();
            currentScrollProgress = targetScrollProgress;

            // Start Animation Loop
            animate();
        }

        // Scaler Engine
        function drawImageProp(image, alpha = 1.0) {
            if (!image) return;

            const cw = cachedCanvasWidth;
            const ch = cachedCanvasHeight;
            const iw = image.width;
            const ih = image.height;

            const canvasRatio = cw / ch;
            const imageRatio = iw / ih;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (canvasRatio > imageRatio) {
                drawWidth = cw;
                drawHeight = cw / imageRatio;
                offsetX = 0;
                offsetY = (ch - drawHeight) / 2;
            } else {
                drawWidth = ch * imageRatio;
                drawHeight = ch;
                offsetX = (cw - drawWidth) / 2;
                offsetY = 0;
            }

            if (alpha < 1.0) {
                ctx.globalAlpha = alpha;
                ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
            }
        }

        function getSafeFrame(frameArray, index) {
            if (!frameArray || frameArray.length === 0) return null;
            let frame = frameArray[index];
            if (!frame) {
                for (let i = index; i >= 0; i--) {
                    if (frameArray[i]) { frame = frameArray[i]; break; }
                }
            }
            if (!frame) {
                for (let i = index; i < frameArray.length; i++) {
                    if (frameArray[i]) { frame = frameArray[i]; break; }
                }
            }
            return frame;
        }

        function drawCurrentFrame(force = false) {
            const scrollTop = currentScrollProgress;

            let currentFrame = null;
            if (scrollTop <= V1_SCROLL_END) {
                if (frames1.length > 0) {
                    const progress1 = Math.max(0, Math.min(1, scrollTop / V1_SCROLL_END));
                    const idx1 = Math.max(0, Math.min(frames1.length - 1, Math.floor(progress1 * (frames1.length - 1))));
                    currentFrame = getSafeFrame(frames1, idx1);
                }
            } else if (scrollTop <= V2_SCROLL_END) {
                if (frames2.length > 0) {
                    const progress2 = Math.max(0, Math.min(1, (scrollTop - V2_SCROLL_START) / (V2_SCROLL_END - V2_SCROLL_START)));
                    const idx2 = Math.max(0, Math.min(frames2.length - 1, Math.floor(progress2 * (frames2.length - 1))));
                    currentFrame = getSafeFrame(frames2, idx2);
                }
            } else {
                if (frames3.length > 0) {
                    const progress3 = Math.max(0, Math.min(1, (scrollTop - V3_SCROLL_START) / (V3_SCROLL_END - V3_SCROLL_START)));
                    const idx3 = Math.max(0, Math.min(frames3.length - 1, Math.floor(progress3 * (frames3.length - 1))));
                    currentFrame = getSafeFrame(frames3, idx3);
                }
            }

            if (currentFrame && (force || currentFrame !== lastRenderedFrame)) {
                drawImageProp(currentFrame, 1.0);
                lastRenderedFrame = currentFrame;
            }
        }

        // High-precision kinetic LERP loop for ultra-smooth 60/120 FPS scrubbing
        function animate() {
            const diff = targetScrollProgress - currentScrollProgress;
            const absDiff = Math.abs(diff);

            if (absDiff < 0.01) {
                currentScrollProgress = targetScrollProgress;
            } else {
                const factor = absDiff > 300 ? 0.38 : (absDiff > 100 ? 0.30 : 0.24);
                currentScrollProgress += diff * factor;
            }

            drawCurrentFrame();
            requestAnimationFrame(animate);
        }
    });
})();
