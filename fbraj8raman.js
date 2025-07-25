// ==UserScript==
// @name         Auto Solve Slider CAPTCHA + Auto Claim rokok
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Auto claim Rokok + otomatis catcha
// @match        https://loyalty.aldmic.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let sliderActive = localStorage.getItem('amild_slider_active') === 'true';
  let claimActive = localStorage.getItem('amild_claim_active') === 'true';
  let retry = 0;
  const maxRetry = 30;
  let targetTime = localStorage.getItem('amild_target_time') || null;
  const startNow = sessionStorage.getItem('amild_start_now') === 'true';
  let statusBox, toggleClaimBtn, inputBtn, toggleSliderBtn;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function isOnVoucherPage() {
    return window.location.href.includes('/reward/');
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

  function createButtons() {
    // Toggle Auto Claim
    toggleClaimBtn = document.createElement('button');
    toggleClaimBtn.innerText = claimActive ? '🟢 Auto Claim ON' : '🔴 Auto Claim OFF';
    toggleClaimBtn.style.cssText = 'position:fixed;top:10px;left:10px;padding:10px 15px;background:' + (claimActive ? '#28a745' : '#dc3545') + ';color:white;border:none;border-radius:5px;cursor:pointer;z-index:9999';
    toggleClaimBtn.onclick = () => {
      claimActive = !claimActive;
      localStorage.setItem('amild_claim_active', claimActive ? 'true' : 'false');
      toggleClaimBtn.innerText = claimActive ? '🟢 Auto Claim ON' : '🔴 Auto Claim OFF';
      toggleClaimBtn.style.background = claimActive ? '#28a745' : '#dc3545';
      if (claimActive) autoClaim();
    };
    document.body.appendChild(toggleClaimBtn);

    // Set Start Time Button
    inputBtn = document.createElement('button');
    inputBtn.innerText = '⏰ Set Start Time';
    inputBtn.style.cssText = 'position:fixed;top:50px;left:10px;padding:10px 15px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;z-index:9999';
    inputBtn.onclick = () => {
      const now = new Date();
      const defaultTime = now.toTimeString().substring(0, 8);
      const input = prompt('Masukkan waktu mulai (format HH:MM:SS, 24 jam):', defaultTime);
      if (input && /^\d{2}:\d{2}:\d{2}$/.test(input)) {
        targetTime = input;
        localStorage.setItem('amild_target_time', targetTime);
        sessionStorage.setItem('amild_start_now', 'false');
        showStatus(`⏳ Menunggu waktu ${targetTime} untuk mulai...`);
        waitUntilTime();
      } else {
        alert('Format salah! Gunakan HH:MM:SS (contoh: 14:05:00)');
      }
    };
    document.body.appendChild(inputBtn);

    // Toggle Slider CAPTCHA
    toggleSliderBtn = document.createElement('button');
    toggleSliderBtn.innerText = sliderActive ? '🟢 Auto Slider ON' : '🔴 Auto Slider OFF';
    toggleSliderBtn.style.cssText = 'position:fixed;top:90px;left:10px;padding:10px 15px;background:' + (sliderActive ? '#28a745' : '#dc3545') + ';color:white;border:none;border-radius:5px;cursor:pointer;z-index:9999';
    toggleSliderBtn.onclick = () => {
      sliderActive = !sliderActive;
      localStorage.setItem('amild_slider_active', sliderActive ? 'true' : 'false');
      toggleSliderBtn.innerText = sliderActive ? '🟢 Auto Slider ON' : '🔴 Auto Slider OFF';
      toggleSliderBtn.style.background = sliderActive ? '#28a745' : '#dc3545';
      if (sliderActive) startCaptchaSolver();
    };
    document.body.appendChild(toggleSliderBtn);

    if (sliderActive) startCaptchaSolver();
    if (claimActive && isOnVoucherPage()) autoClaim();
  }

  function waitUntilTime() {
    const check = setInterval(() => {
      const now = new Date();
      const nowStr = now.toTimeString().substring(0, 8);
      if (nowStr >= targetTime) {
        clearInterval(check);
        if (!isOnVoucherPage()) return showStatus('⛔ Bukan di halaman voucher. Auto-claim dihentikan.');
        sessionStorage.setItem('amild_start_now', 'true');
        location.href = location.href.split('?')[0] + '?r=' + Math.random().toString(36).substring(7);
      } else {
        showStatus(`⏳ Sekarang ${nowStr}, menunggu ${targetTime}...`);
      }
    }, 1000);
  }

  function autoClaim() {
    if (!claimActive || !isOnVoucherPage()) return;
    const tombol = [...document.querySelectorAll('button')].find(b => b.innerText.toLowerCase().includes('redeem now'));
    if (tombol && !tombol.disabled) {
      tombol.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => tombol.click(), 300);
      showStatus('✅ Klik tombol Redeem.');
    } else {
      retry++;
      if (retry < maxRetry) setTimeout(() => location.reload(), 3000);
      else showStatus('❌ Maksimal percobaan auto-claim tercapai.');
    }
  }

  // === Slider CAPTCHA ===
  async function loadOpenCV() {
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

  async function waitForCanvases(min = 2, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const canvases = Array.from(document.querySelectorAll("canvas")).filter(c => c.width > 10);
        if (canvases.length >= min) {
          clearInterval(interval);
          resolve(canvases);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject("Timeout: Tidak cukup canvas ditemukan");
        }
      }, 80);
    });
  }

  function detectPuzzleX() {
    const canvases = Array.from(document.querySelectorAll("canvas")).filter(c => c.width > 10);
    if (canvases.length < 2) return null;
    try {
      const bg = cv.imread(canvases[0]);
      const puzzle = cv.imread(canvases[1]);
      const result = new cv.Mat();
      cv.matchTemplate(bg, puzzle, result, cv.TM_CCOEFF_NORMED);
      const { maxLoc } = cv.minMaxLoc(result);
      bg.delete(); puzzle.delete(); result.delete();
      return maxLoc.x;
    } catch {
      return null;
    }
  }

  function simulateDrag(elem, startX, endX, y) {
    const steps = 6;
    const mouseEvent = (type, x, y) => {
      elem.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    };
    mouseEvent('mousedown', startX, y);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const x = startX + ((endX - startX) * i / steps);
      mouseEvent('mousemove', x, y);
      if (i === steps) {
        clearInterval(interval);
        setTimeout(() => mouseEvent('mouseup', endX, y), 30);
      }
    }, 15);
  }

  async function startCaptchaSolver() {
    try {
      await loadOpenCV();
      await waitForCanvases();
      const x = detectPuzzleX();
      if (!x || x < 10) return;
      const slider = document.querySelector('.sliderIcon, .geetest_slider_button');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const endX = startX + x + 13.5;
      const y = rect.top + rect.height / 2;
      simulateDrag(slider, startX, endX, y);
    } catch (e) {
      console.warn('Captcha Solver Error:', e);
    }
  }

  window.addEventListener('load', () => {
    createButtons();
    if (startNow) {
      sessionStorage.setItem('amild_start_now', 'false');
      showStatus('🚀 Mulai auto claim setelah refresh awal...');
    } else if (targetTime) {
      waitUntilTime();
    } else {
      showStatus('🔴 Auto Claim belum aktif.');
    }
  });
})();
