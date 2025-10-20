// Constants
    const KA_ETHANOIC = 1.8e-5; // Ka of ethanoic acid
    const KB_AMMONIA = 1.8e-5; // Kb of ammonia
    const KW = 1.0e-14; // Water dissociation constant

    // State variables
    let simulationType = 'strongAcidStrongBase';
    let concentration = {
      acid: 0.1, // mol/L
      base: 0.1, // mol/L
    };
    let volume = {
      acid: 25, // mL
      base: 0, // mL (will be added during titration)
    };
    let running = false;
    let speed = 10; // mL per second
    let pH = 0;
    let data = [];
    let equivalencePoint = null;
    let lastPoint = null;
    let info = {
      acid: 'HCl (strong acid)',
      base: 'NaOH (strong base)',
      color: '#f8f9fa'
    };
    let animationFrameId = null;
    const baseAddedInterval = 0.1; // mL added per frame

    // DOM elements
    const titrationType = document.getElementById('titration-type');
    const acidConcentration = document.getElementById('acid-concentration');
    const baseConcentration = document.getElementById('base-concentration');
    const titrationSpeed = document.getElementById('titration-speed');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnReset = document.getElementById('btn-reset');
    const btnAddSmall = document.getElementById('btn-add-small');
    const btnAddLarge = document.getElementById('btn-add-large');
    const solution = document.getElementById('solution');
    const drop = document.getElementById('drop');
    const currentPh = document.getElementById('current-ph');
    const baseAdded = document.getElementById('base-added');
    const solutionInfo = document.getElementById('solution-info');
    const equivalencePointInfo = document.getElementById('equivalence-point-info');
    const equivalenceLineInfo = document.getElementById('equivalence-line-info');
    const titrationCurve = document.getElementById('titration-curve');

    // SVG parameters
    const svgWidth = 400;
    const svgHeight = 300;
    const padding = 40;
    const xScale = (svgWidth - 2 * padding) / 50; // 50 mL max
    const yScale = (svgHeight - 2 * padding) / 14; // pH 0-14

    // Initialize the SVG
    function initializeSVG() {
      // Clear previous content
      titrationCurve.innerHTML = '';
      
      // X and Y axes
      appendSVGElement('line', {
        x1: padding,
        y1: svgHeight - padding,
        x2: svgWidth - padding,
        y2: svgHeight - padding,
        stroke: 'black'
      });
      
      appendSVGElement('line', {
        x1: padding,
        y1: padding,
        x2: padding,
        y2: svgHeight - padding,
        stroke: 'black'
      });
      
      // X-axis labels
      appendSVGElement('text', {
        x: svgWidth / 2,
        y: svgHeight - 2,
        'text-anchor': 'middle',
        textContent: 'Volume of Base Added (mL)'
      });
      
      [0, 10, 20, 30, 40, 50].forEach(v => {
        appendSVGElement('line', {
          x1: padding + v * xScale,
          y1: svgHeight - padding,
          x2: padding + v * xScale,
          y2: svgHeight - padding + 5,
          stroke: 'black'
        });
        
        appendSVGElement('text', {
          x: padding + v * xScale,
          y: svgHeight - padding + 20,
          'text-anchor': 'middle',
          'font-size': '12',
          textContent: v.toString()
        });
      });
      
      // Y-axis labels
      appendSVGElement('text', {
        x: 15,
        y: svgHeight / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90, 15, ${svgHeight / 2})`,
        textContent: 'pH'
      });
      
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(v => {
        appendSVGElement('line', {
          x1: padding - 5,
          y1: svgHeight - padding - v * yScale,
          x2: padding,
          y2: svgHeight - padding - v * yScale,
          stroke: 'black'
        });
        
        appendSVGElement('text', {
          x: padding - 10,
          y: svgHeight - padding - v * yScale + 5,
          'text-anchor': 'end',
          'font-size': '12',
          textContent: v.toString()
        });
      });
    }

    // Helper function to create SVG elements
    function appendSVGElement(type, attributes) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', type);
      for (const [key, value] of Object.entries(attributes)) {
        if (key === 'textContent') {
          element.textContent = value;
        } else {
          element.setAttribute(key, value);
        }
      }
      titrationCurve.appendChild(element);
      return element;
    }

    // Set up initial state
    function initialize() {
      volume = { acid: 25, base: 0 };
      data = [];
      pH = 0;
      equivalencePoint = null;
      lastPoint = null;
      
      updateTitrationType();
      updateDisplay();
      initializeSVG();
      
      // Add initial data point
      const initialPH = calculatePH(volume.acid, 0);
      pH = initialPH;
      data = [{ volume: 0, pH: initialPH }];
      lastPoint = { volume: 0, pH: initialPH };
      
      updateDisplay();
      updateGraph();
    }

    // Update titration type and info
    function updateTitrationType() {
      switch (simulationType) {
        case 'strongAcidStrongBase':
          info = {
            acid: 'HCl (strong acid)',
            base: 'NaOH (strong base)',
            color: '#f8f9fa'
          };
          break;
        case 'weakAcidStrongBase':
          info = {
            acid: 'CH₃COOH (weak acid)',
            base: 'NaOH (strong base)',
            color: '#f8f9fa'
          };
          break;
        case 'strongAcidWeakBase':
          info = {
            acid: 'HCl (strong acid)',
            base: 'NH₃ (weak base)',
            color: '#f8f9fa'
          };
          break;
      }
      
      solutionInfo.textContent = `${info.acid} + ${info.base}`;
    }

    // Calculate pH based on titration type and volumes
    function calculatePH(acidVol, baseVol) {
      const nAcid = (acidVol / 1000) * concentration.acid; // moles of acid
      const nBase = (baseVol / 1000) * concentration.base; // moles of base
      const totalVolume = (acidVol + baseVol) / 1000; // total volume in L

      // Different calculations based on titration type
      switch (simulationType) {
        case 'strongAcidStrongBase': // HCl + NaOH
          if (nAcid > nBase) {
            // Excess acid
            const excessH = nAcid - nBase;
            const cH = excessH / totalVolume;
            return -Math.log10(cH);
          } else if (nAcid < nBase) {
            // Excess base
            const excessOH = nBase - nAcid;
            const cOH = excessOH / totalVolume;
            const cH = KW / cOH;
            return -Math.log10(cH);
          } else {
            // Equivalence point for strong acid-strong base is pH 7
            return 7;
          }

        case 'weakAcidStrongBase': // CH3COOH + NaOH
          if (nAcid > nBase) {
            // Before equivalence point: buffer region if some base has been added
            if (baseVol > 0) {
              const cHA = (nAcid - nBase) / totalVolume; // unreacted acid concentration
              const cA = nBase / totalVolume; // conjugate base concentration
              return -Math.log10(KA_ETHANOIC) + Math.log10(cA / cHA);
            } else {
              // Initial pH of weak acid solution
              const cHA = nAcid / totalVolume;
              return -Math.log10(Math.sqrt(KA_ETHANOIC * cHA));
            }
          } else if (nAcid < nBase) {
            // Excess strong base
            const excessOH = nBase - nAcid;
            const cOH = excessOH / totalVolume;
            const cH = KW / cOH;
            return -Math.log10(cH);
          } else {
            // Equivalence point: hydrolysis of acetate ion
            const cA = nAcid / totalVolume; // all acid converted to conjugate base
            const cOH = Math.sqrt(KW * cA / KA_ETHANOIC);
            const cH = KW / cOH;
            return -Math.log10(cH);
          }

        case 'strongAcidWeakBase': // HCl + NH3
          if (nAcid > nBase) {
            // Excess strong acid
            const excessH = nAcid - nBase;
            const cH = excessH / totalVolume;
            return -Math.log10(cH);
          } else if (nAcid < nBase) {
            // After equivalence point: buffer region with excess weak base
            const cB = (nBase - nAcid) / totalVolume; // unreacted base concentration
            const cBH = nAcid / totalVolume; // conjugate acid concentration
            const cOH = KB_AMMONIA * cB / cBH;
            const cH = KW / cOH;
            return -Math.log10(cH);
          } else {
            // Equivalence point: hydrolysis of ammonium ion
            const cBH = nAcid / totalVolume; // all base converted to conjugate acid
            const cH = Math.sqrt(KW * cBH / KB_AMMONIA);
            return -Math.log10(cH);
          }

        default:
          return 7;
      }
    }

    // Calculate equivalence point
    function calculateEquivalencePoint() {
      // Equivalence point occurs when moles of acid = moles of base
      const molesAcid = (volume.acid / 1000) * concentration.acid;
      const baseVolume = (molesAcid / concentration.base) * 1000;
      return baseVolume;
    }

    // Get color based on pH
    function getSolutionColor(pH) {
      // Red for acidic, purple for neutral, blue for basic
      if (pH < 4) return '#ff7f7f'; // Strong acid - red
      if (pH < 6) return '#ffb997'; // Weak acid - light red/orange
      if (pH >= 6 && pH <= 8) return '#da70d6'; // Near neutral - purple
      if (pH > 8 && pH < 11) return '#a1caf1'; // Weak base - light blue
      return '#7fb3ff'; // Strong base - blue
    }

    // Update the display
    function updateDisplay() {
      currentPh.textContent = pH.toFixed(2);
      baseAdded.textContent = volume.base.toFixed(1);
      solution.style.backgroundColor = info.color;
      
      // Check if we've reached equivalence point
      const eqPoint = calculateEquivalencePoint();
      if (volume.base >= eqPoint && !equivalencePoint) {
        equivalencePoint = eqPoint;
        equivalencePointInfo.textContent = `Equivalence Point Reached at ${equivalencePoint.toFixed(1)} mL!`;
        equivalencePointInfo.style.display = 'block';
        equivalenceLineInfo.textContent = ` The vertical red line indicates the equivalence point at ${equivalencePoint.toFixed(1)} mL.`;
        equivalenceLineInfo.style.display = 'inline';
        
        // Add equivalence point line to graph
        appendSVGElement('line', {
          x1: padding + equivalencePoint * xScale,
          y1: padding,
          x2: padding + equivalencePoint * xScale,
          y2: svgHeight - padding,
          stroke: 'red',
          'stroke-dasharray': '4'
        });
      }
      
      // Update drop animation
      if (running) {
        drop.style.display = 'block';
      } else {
        drop.style.display = 'none';
      }
    }

    // Update the graph
    function updateGraph() {
      // Remove old path and point
      const oldPath = titrationCurve.querySelector('path');
      if (oldPath) oldPath.remove();
      
      const oldPoint = titrationCurve.querySelector('circle');
      if (oldPoint) oldPoint.remove();
      
      // Create new path
      if (data.length >= 2) {
        const pathData = data.map((point, i) => {
          const x = padding + point.volume * xScale;
          const y = svgHeight - padding - point.pH * yScale;
          return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
        
        appendSVGElement('path', {
          d: pathData,
          fill: 'none',
          stroke: 'blue',
          'stroke-width': '2'
        });
      }
      
      // Add current point
      if (lastPoint) {
        appendSVGElement('circle', {
          cx: padding + lastPoint.volume * xScale,
          cy: svgHeight - padding - lastPoint.pH * yScale,
          r: '4',
          fill: 'red'
        });
      }
    }

    // Animation loop
    function animate() {
      if (running) {
        const newBaseVolume = Math.min(volume.base + baseAddedInterval * speed, 50);
        
        // Stop if we've reached the limit
        if (newBaseVolume >= 50) {
          running = false;
          btnStart.disabled = false;
          btnStop.disabled = true;
          drop.style.display = 'none';
        }
        
        volume.base = newBaseVolume;
        
        // Calculate new pH
        pH = calculatePH(volume.acid, volume.base);
        info.color = getSolutionColor(pH);
        
        // Add data point
        data.push({ volume: volume.base, pH });
        lastPoint = { volume: volume.base, pH };
        
        // Update display
        updateDisplay();
        updateGraph();
        
        // Continue animation
        if (running) {
          animationFrameId = requestAnimationFrame(animate);
        }
      }
    }

    // Event handlers
    btnStart.addEventListener('click', () => {
      running = true;
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnAddSmall.disabled = true;
      btnAddLarge.disabled = true;
      titrationType.disabled = true;
      acidConcentration.disabled = true;
      baseConcentration.disabled = true;
      
      animationFrameId = requestAnimationFrame(animate);
    });

    btnStop.addEventListener('click', () => {
      running = false;
      btnStart.disabled = false;
      btnStop.disabled = true;
      btnAddSmall.disabled = false;
      btnAddLarge.disabled = false;
      titrationType.disabled = false;
      acidConcentration.disabled = false;
      baseConcentration.disabled = false;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      drop.style.display = 'none';
    });

    btnReset.addEventListener('click', () => {
      running = false;
      btnStart.disabled = false;
      btnStop.disabled = true;
      btnAddSmall.disabled = false;
      btnAddLarge.disabled = false;
      titrationType.disabled = false;
      acidConcentration.disabled = false;
      baseConcentration.disabled = false;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      drop.style.display = 'none';
      equivalencePointInfo.style.display = 'none';
      equivalenceLineInfo.style.display = 'none';
      
      initialize();
    });

    btnAddSmall.addEventListener('click', () => {
      addBase(0.1);
    });

    btnAddLarge.addEventListener('click', () => {
      addBase(1.0);
    });

    titrationType.addEventListener('change', () => {
      simulationType = titrationType.value;
      initialize();
    });

    acidConcentration.addEventListener('change', () => {
      concentration.acid = parseFloat(acidConcentration.value);
      initialize();
    });

    baseConcentration.addEventListener('change', () => {
      concentration.base = parseFloat(baseConcentration.value);
      initialize();
    });

    titrationSpeed.addEventListener('input', () => {
      speed = parseInt(titrationSpeed.value);
    });

    // Function to add base manually
    function addBase(amount) {
      const newBaseVolume = Math.min(volume.base + amount, 50);
      volume.base = newBaseVolume;
      
      // Calculate new pH
      pH = calculatePH(volume.acid, volume.base);
      info.color = getSolutionColor(pH);
      
      // Add data point
      data.push({ volume: volume.base, pH });
      lastPoint = { volume: volume.base, pH };
      
      // Update display
      updateDisplay();
      updateGraph();
      
      // Disable buttons if we've reached the limit
      if (volume.base >= 50) {
        btnStart.disabled = true;
        btnAddSmall.disabled = true;
        btnAddLarge.disabled = true;
      }
    }

    // Initialize the simulator
    initialize();