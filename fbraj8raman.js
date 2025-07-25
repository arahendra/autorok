// ==UserScript==
// @name         A Mild Auto Claim + Auto CAPTCHA Solver (Final v3.0 + v1.8.2)
// @namespace    http://tampermonkey.net/
// @version      3.0.1
// @description  Gabungan Auto Claim voucher A Mild + Auto Solve CAPTCHA Slider (OpenCV, retry otomatis, beep, refresh acak)
// @match        https://loyalty.aldmic.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /********** Auto Claim Voucher **********/
    let active = false;
    let retry = 0;
    const maxRetry = 30;
    let statusBox;
    let targetTime = localStorage.getItem('amild_target_time') || null;
    const startNow = sessionStorage.getItem('amild_start_now') === 'true';
    let toggleBtn, inputBtn;

    function isOnVoucherPage() {
        return window.location.href.includes('/reward/');
    }

    function playBeep(freq = 1000, duration = 200) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
            osc.stop();
            ctx.close();
        }, duration);
    }

    function playSuccessBeep() {
        playBeep(800, 150);
        setTimeout(() => playBeep(1200, 150), 200);
    }

    function getRandomDelay(min = 3000, max = 10000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function showStatus(msg) {
        if (!statusBox) {
            statusBox = document.createElement('div');
            statusBox.style.position = 'fixed';
            statusBox.style.bottom = '10px';
            statusBox.style.right = '10px';
            statusBox.style.background = '#111';
            statusBox.style.color = '#fff';
            statusBox.style.padding = '10px';
            statusBox.style.fontSize = '14px';
            statusBox.style.borderRadius = '10px';
            statusBox.style.zIndex = 9999;
            document.body.appendChild(statusBox);
        }
        statusBox.innerText = msg;
    }

    function createToggleButton() {
        toggleBtn = document.createElement('button');
        toggleBtn.innerText = '🔴 Auto Claim OFF';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.top = '10px';
        toggleBtn.style.left = '10px';
        toggleBtn.style.padding = '10px 15px';
        toggleBtn.style.background = '#dc3545';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.borderRadius = '5px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.zIndex = 9999;

        toggleBtn.onclick = () => {
            active = !active;
            toggleBtn.innerText = active ? '🟢 Auto Claim ON' : '🔴 Auto Claim OFF';
            toggleBtn.style.background = active ? '#28a745' : '#dc3545';
        };

        document.body.appendChild(toggleBtn);
    }

    function createTimeInputButton() {
        inputBtn = document.createElement('button');
        inputBtn.innerText = '⏰ Set Start Time';
        inputBtn.style.position = 'fixed';
        inputBtn.style.top = '50px';
        inputBtn.style.left = '10px';
        inputBtn.style.padding = '10px 15px';
        inputBtn.style.background = '#007bff';
        inputBtn.style.color = 'white';
        inputBtn.style.border = 'none';
        inputBtn.style.borderRadius = '5px';
        inputBtn.style.cursor = 'pointer';
        inputBtn.style.zIndex = 9999;

        inputBtn.onclick = () => {
            const now = new Date();
            const defaultTime = now.toTimeString().substring(0, 8);
            const input = prompt("Masukkan waktu mulai (format HH:MM:SS, 24 jam):", defaultTime);
            if (input && /^\d{2}:\d{2}:\d{2}$/.test(input)) {
                targetTime = input;
                localStorage.setItem('amild_target_time', targetTime);
                sessionStorage.setItem('amild_start_now', 'false');
                showStatus(`⏳ Menunggu waktu ${targetTime} untuk mulai...`);
                waitUntilTime();
            } else {
                alert("Format salah! Gunakan HH:MM:SS (contoh: 14:05:00)");
            }
        };

        document.body.appendChild(inputBtn);
    }

    function waitUntilTime() {
        const check = setInterval(() => {
            const now = new Date();
            const nowStr = now.toTimeString().substring(0, 8);
            if (nowStr >= targetTime) {
                clearInterval(check);
                if (!isOnVoucherPage()) return;
                sessionStorage.setItem('amild_start_now', 'true');
                const base = window.location.href.split('?')[0];
                window.location.href = base + '?r=' + Math.random().toString(36).substring(7);
            } else {
                showStatus(`⏳ Sekarang ${nowStr}, menunggu ${targetTime}...`);
            }
        }, 1000);
    }

    function stealthRefreshWithRandomDelay() {
        if (!isOnVoucherPage()) return;

        const delay = getRandomDelay();
        let seconds = Math.floor(delay / 1000);
        playBeep();
        showStatus(`🔄 Refresh acak dalam ${seconds} detik...`);
        const interval = setInterval(() => {
            seconds--;
            showStatus(`🔄 Refresh acak dalam ${seconds} detik...`);
            if (seconds <= 0) {
                clearInterval(interval);
                const base = window.location.href.split('?')[0];
                window.location.href = base + '?r=' + Math.random().toString(36).substring(7);
            }
        }, 1000);
    }

    function autoClaim() {
        if (!active || !isOnVoucherPage()) return;

        const tombol = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toLowerCase().includes('redeem now'));
        const disabled = tombol?.disabled;
        const isLimitReached = tombol?.innerText.toLowerCase().includes('daily limit');

        if (isLimitReached || disabled) {
            showStatus("❌ Sudah daily limit. Stop auto claim.");
            return;
        }

        if (tombol) {
            showStatus("✅ Klik otomatis tombol Redeem...");
            playSuccessBeep();
            tombol.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => tombol.click(), 300);
        } else {
            retry++;
            if (retry >= maxRetry) {
                showStatus("⚠️ Sudah coba " + retry + " kali. Stop otomatis.");
                return;
            }
            stealthRefreshWithRandomDelay();
        }
    }

    /********** Auto Solve Slider CAPTCHA **********/
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function loadOpenCV() {
        return new Promise((resolve, reject) => {
            if (window.cv) return resolve();
            const script = document.createElement("script");
            script.src = "https://docs.opencv.org/4.x/opencv.js";
            script.onload = () => {
                cv['onRuntimeInitialized'] = () => resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function waitForCanvases(min = 2, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                const canvases = Array.from(document.querySelectorAll("canvas")).filter(c => c.width > 10 && c.height > 10);
                if (canvases.length >= min) {
                    clearInterval(interval);
                    resolve(canvases);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject("⛔ Timeout: Tidak cukup canvas valid ditemukan");
                }
            }, 80);
        });
    }

    function detectPuzzleX_aldmic() {
        const canvases = Array.from(document.querySelectorAll('canvas')).filter(c => c.width > 10 && c.height > 10);
        if (canvases.length < 2) return null;

        const tryMatch = (bgCanvas, puzzleCanvas) => {
            try {
                const bg = cv.imread(bgCanvas);
                const puzzle = cv.imread(puzzleCanvas);
                const result = new cv.Mat();
                cv.matchTemplate(bg, puzzle, result, cv.TM_CCOEFF_NORMED);
                const x = cv.minMaxLoc(result).maxLoc.x;
                bg.delete(); puzzle.delete(); result.delete();
                if (x > 5) return x;
            } catch (e) {}
            return null;
        };

        return tryMatch(canvases[1], canvases[0]) || tryMatch(canvases[0], canvases[1]) || null;
    }

    function simulateSmoothDrag(elem, startX, endX, topY) {
        const steps = 6;
        let currentStep = 0;

        const mouseEvent = (type, x, y) => {
            const evt = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
            elem.dispatchEvent(evt);
        };

        setTimeout(() => {
            mouseEvent('mousedown', startX, topY);
            const interval = setInterval(() => {
                currentStep++;
                const progress = currentStep / steps;
                const currentX = startX + (endX - startX) * progress;
                const jitterY = topY + Math.random() * 3 - 1.5;
                mouseEvent('mousemove', currentX, jitterY);
                if (currentStep >= steps) {
                    clearInterval(interval);
                    setTimeout(() => mouseEvent('mouseup', endX, topY), 30);
                }
            }, 15);
        }, 100);
    }

    async function autoSolveSliderCaptchaLoop() {
        let attempt = 1;
        while (true) {
            await sleep(300);
            const canvases = document.querySelectorAll("canvas");
            if (canvases.length < 2) { await sleep(1000); continue; }

            let x = detectPuzzleX_aldmic();
            if (!x || x < 10) { await sleep(1000); continue; }

            const slider = document.querySelector('.sliderIcon') || document.querySelector('.geetest_slider_button');
            if (!slider) { await sleep(1000); continue; }

            x += 13.5;
            const rect = slider.getBoundingClientRect();
            simulateSmoothDrag(slider, rect.left + rect.width / 2, rect.left + rect.width / 2 + x, rect.top + rect.height / 2);
            await sleep(2000);

            const bodyText = document.body.innerText || "";
            if (!bodyText.includes("Coba lagi bro")) break;

            document.querySelector('img[alt="refresh"]')?.click();
            await sleep(1500);
        }
    }

    async function startCaptchaSolver() {
        try {
            await Promise.all([loadOpenCV(), waitForCanvases()]);
            await sleep(300);
            autoSolveSliderCaptchaLoop();
        } catch (e) {
            console.error("❌ CAPTCHA Solver gagal:", e);
        }
    }

    /********** Main Loader **********/
    window.addEventListener("load", () => {
        createToggleButton();
        createTimeInputButton();
        startCaptchaSolver();

        if (startNow && isOnVoucherPage()) {
            showStatus("🚀 Mulai auto claim setelah refresh awal...");
            active = true;
            toggleBtn.innerText = '🟢 Auto Claim ON';
            toggleBtn.style.background = '#28a745';
            sessionStorage.setItem('amild_start_now', 'false');
            autoClaim();
        } else if (targetTime) {
            const now = new Date();
            const nowStr = now.toTimeString().substring(0, 8);
            if (nowStr >= targetTime && isOnVoucherPage()) {
                showStatus("⏰ Waktu sudah lewat. Mulai auto claim langsung...");
                active = true;
                toggleBtn.innerText = '🟢 Auto Claim ON';
                toggleBtn.style.background = '#28a745';
                autoClaim();
            } else {
                showStatus(`⏳ Menunggu waktu ${targetTime} untuk mulai...`);
                waitUntilTime();
            }
        } else {
            showStatus("🔴 Auto Claim belum aktif. Gunakan tombol ⏰ untuk set waktu mulai.");
        }
    });
})();
