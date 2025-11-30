const tabs = document.querySelectorAll('.Tab');
const sections = document.querySelectorAll('.the-section');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
    const targetId = tab.dataset.target;

    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === targetId);
    });
    });
});

const margin = {
    top: 60,
    right: 200,
    bottom: 60,
    left: 70
};
const width = 1100 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// bubble svg
const bsvg = d3
  .select("#bubblechart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// region, division, state definitions
const DIVISION_TO_REGION = {
    "New England Division": "northeast",
    "Middle Atlantic Division": "northeast",

    "East North Central Division": "midwest",
    "West North Central Division": "midwest",

    "South Atlantic Division": "south",
    "East South Central Division": "south",
    "West South Central Division": "south",

    "Mountain Division": "west",
    "Pacific Division": "west"
};

const REGION_LIST = ["west", "south", "midwest", "northeast"];

const REGION_COLORS = {
    west: "#1f77b4",
    south: "#aec7e8",
    midwest: "#2ca02c",
    northeast: "#ff7f0e"
};

// Divisions to states map
const DIVISION_TO_STATES = {
    "New England Division": ["CT", "ME", "MA", "NH", "RI", "VT"],
    "Middle Atlantic Division": ["NJ", "NY", "PA"],
    "East North Central Division": ["IL", "IN", "MI", "OH", "WI"],
    "West North Central Division": ["IA", "KS", "MN", "MO", "NE", "ND", "SD"],
    "South Atlantic Division": ["DE", "FL", "GA", "MD", "NC", "SC", "VA", "WV", "DC"],
    "East South Central Division": ["AL", "KY", "MS", "TN"],
    "West South Central Division": ["AR", "LA", "OK", "TX"],
    "Mountain Division": ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"],
    "Pacific Division": ["AK", "CA", "HI", "OR", "WA"]
};

let CURRENT_LEVEL = "region";
let CURRENT_REGION = null;
let CURRENT_DIVISION = null;

function extractState(place) {
    const m = place.match(/,\s*([A-Z]{2})$/);
    return m ? m[1] : null;
}

d3.csv("hpi_master.csv").then(raw => {

    raw.forEach(d => {
        d.yr = +d.yr;
        d.period = +d.period;
        d.index_nsa = +d.index_nsa;
        d.date = new Date(d.yr, d.period - 1, 1);
    });

    window.HPI = raw;

    drawRegions();
    drawBubbleChart();
});

function drawRegions() {

    CURRENT_LEVEL = "region";
    CURRENT_REGION = null;
    CURRENT_DIVISION = null;
    clearSVG();

    const rows = HPI.filter(d => d.level === "USA or Census Division");

    const byYear = d3.group(rows, d => d.date.getFullYear());
    const yearly = [];

    for (const [yr, vals] of byYear.entries()) {
        const row = {
            date: new Date(yr, 0, 1)
        };

        for (const region of REGION_LIST) {
            const divisionList = Object.keys(DIVISION_TO_REGION)
                .filter(div => DIVISION_TO_REGION[div] === region);

            const nums = vals
                .filter(v => divisionList.includes(v.place_name))
                .map(v => v.index_nsa);

            row[region] = nums.length ? d3.mean(nums) : null;
        }

        yearly.push(row);
    }

    const filtered = yearly.filter(r => r.date.getFullYear() >= 1990);
    filtered.sort((a, b) => a.date - b.date);

    renderStackedArea(
        filtered,
        REGION_LIST,
        REGION_COLORS,
        "US Housing Price Index (Index NSA) — Regions (Yearly)",
        onRegionClick
    );
}

function onRegionClick(region) {
    CURRENT_LEVEL = "division";
    CURRENT_REGION = region;
    drawDivisions(region);
}

function drawDivisions(region) {

    clearSVG();

    const rows = HPI.filter(d => d.level === "USA or Census Division");
    const byYear = d3.group(rows, d => d.date.getFullYear());

    const divisions = Object.keys(DIVISION_TO_REGION)
        .filter(div => DIVISION_TO_REGION[div] === region);

    const yearly = [];

    for (const [yr, vals] of byYear.entries()) {
        const row = {
            date: new Date(yr, 0, 1)
        };

        for (const div of divisions) {
            const nums = vals
                .filter(v => v.place_name === div)
                .map(v => v.index_nsa);

            row[div] = nums.length ? d3.mean(nums) : null;
        }

        yearly.push(row);
    }

    const filtered = yearly.filter(r => r.date.getFullYear() >= 1990);
    filtered.sort((a, b) => a.date - b.date);

    const colors = {};
    divisions.forEach((d, i) => colors[d] = d3.schemeTableau10[i % 10]);

    renderStackedArea(
        filtered,
        divisions,
        colors,
        `Index NSA — Divisions in ${region.toUpperCase()} (Yearly)`,
        onDivisionClick
    );

    showBackButton(drawRegions);
}

function onDivisionClick(division) {
    CURRENT_LEVEL = "state";
    CURRENT_DIVISION = division;
    drawStates(division);
}

function drawStates(division) {

    clearSVG();

    const stateList = DIVISION_TO_STATES[division];
    const rows = HPI.filter(
        d => d.level === "State" && stateList.includes(d.place_id)
    );

    const byYear = d3.group(rows, d => d.date.getFullYear());
    const yearly = [];

    for (const [yr, vals] of byYear.entries()) {
        const row = {
            date: new Date(yr, 0, 1)
        };

        for (const st of stateList) {
            const nums = vals
                .filter(v => v.place_id === st)
                .map(v => v.index_nsa);

            row[st] = nums.length ? d3.mean(nums) : null;
        }

        yearly.push(row);
    }

    const filtered = yearly.filter(r => r.date.getFullYear() >= 1990);
    filtered.sort((a, b) => a.date - b.date);

    const colors = {};
    stateList.forEach((s, i) => colors[s] = d3.schemeTableau10[i % 10]);

    renderStackedArea(
        filtered,
        stateList,
        colors,
        `Index NSA — States in ${division.toUpperCase()} (Yearly)`
    );

    showBackButton(() => drawDivisions(CURRENT_REGION));
}

function clearSVG() {
    svg.selectAll("*").remove();
}

function showBackButton(callback) {
    svg.append("text")
        .attr("x", -50)
        .attr("y", -20)
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .style("cursor", "pointer")
        .text("← Back")
        .on("click", callback);
}

function renderStackedArea(data, keys, colors, title, clickHandler = null) {

    clearSVG();

    const lastDate = d3.max(data, d => d.date);
    const sortedKeys = keys.slice().sort((a, b) => {
        const finalRow = data.find(d => d.date.getTime() === lastDate.getTime());
        const finalA = finalRow?.[a] ?? 0;
        const finalB = finalRow?.[b] ?? 0;
        return finalA - finalB;
    });

    const x = d3.scaleTime()
        .domain([new Date(1990, 0, 1), lastDate])
        .range([0, width]);

    const stack = d3.stack().keys(sortedKeys);
    const stackedData = stack(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData.at(-1), d => d[1])])
        .range([height, 0]);

    const area = d3.area()
        .curve(d3.curveMonotoneX)
        .x(d => x(d.data.date))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    svg.selectAll(".layer")
        .data(stackedData)
        .enter().append("path")
        .attr("class", "layer")
        .attr("d", area)
        .attr("fill", d => colors[d.key])
        .attr("stroke", "black")
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.9)
        .style("cursor", clickHandler ? "pointer" : "default")
        .on("click", (event, d) => clickHandler && clickHandler(d.key));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(() => ""));

    stackedData.forEach(layer => {
        const key = layer.key;
        const lastPoint = layer.find(p => p.data.date.getTime() === lastDate.getTime());
        if (!lastPoint) return;

        const yMid = (lastPoint[0] + lastPoint[1]) / 2;

        svg.append("text")
            .attr("x", x(lastDate) + 10)
            .attr("y", y(yMid))
            .attr("alignment-baseline", "middle")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("fill", colors[key])
            .text(Math.round(lastPoint.data[key]));
    });

    const firstDate = d3.min(data, d => d.date);

    stackedData.forEach(layer => {
        const key = layer.key;
        const firstPoint = layer.find(p => p.data.date.getTime() === firstDate.getTime());
        if (!firstPoint) return;

        const yMidLeft = (firstPoint[0] + firstPoint[1]) / 2;

        svg.append("text")
            .attr("x", -10)
            .attr("y", y(yMidLeft))
            .attr("text-anchor", "end")
            .attr("alignment-baseline", "middle")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("fill", colors[key])
            .text(Math.round(firstPoint.data[key]));
    });

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .style("font-weight", "bold")
        .text(title);

    const legend = svg.append("g")
        .attr("transform", `translate(${width + 80}, 20)`);

    [...sortedKeys].reverse().forEach((k, i) => {
        const g = legend.append("g")
            .attr("transform", `translate(0, ${i * 30})`);

        g.append("rect")
            .attr("width", 22)
            .attr("height", 22)
            .attr("fill", colors[k])
            .attr("stroke", "black");

        g.append("text")
            .attr("x", 28)
            .attr("y", 16)
            .style("font-size", "14px")
            .text(k);
    });
}
function drawBubbleChart() {
    const stateData = HPI.filter((d) => d.level === "State");

    const statesByYear = d3.group(stateData, (d) => d.yr);
    const years = Array.from(statesByYear.keys()).sort((a,b) => a - b);

    const STATE_TO_REGION = {};
    Object.entries(DIVISION_TO_STATES).forEach(([division, states]) => {
        const region = DIVISION_TO_REGION[division];
        states.forEach((stateId) => {
            STATE_TO_REGION[stateId] = region;
        });
    });

    function prepareYearData(year){
        const yearData = statesByYear.get(year);
        if (!yearData) return [];

        const regionSeries = [];

        const stateMap = d3.group(yearData, (d) => d.place_id);

        stateMap.forEach((rows, stateId) => {
            const averageHPI = d3.mean(rows, (d) => d.index_nsa);
            const region = STATE_TO_REGION[stateId] || "west";

            regionSeries.push({
                name: rows[0].place_name,
                id: stateId,
                abbr: stateId,
                hpi: averageHPI,
                region: region,
                x: width/2,
                y: height/2,
            });
        });
        return regionSeries;
    }

    const allHPIValues = years.flatMap(year => 
        prepareYearData(year).map(d => d.hpi)
    );
    const globalMaxHPI = d3.max(allHPIValues);

    const radiusScale = d3.scaleSqrt()
        .domain([0, globalMaxHPI])
        .range([8, 45]);

    const simulation = d3.forceSimulation()
        .force("charge", d3.forceManyBody().strength(2))
        .force("center", d3.forceCenter(width/2, height/2))
        .force("collision", d3.forceCollide().radius((d) => radiusScale(d.hpi) + 2))
        .force("x", d3.forceX(width / 2).strength(0.15))
        .force("y", d3.forceY(height / 2).strength(0.15))
        .velocityDecay(0.2)
        .alphaDecay(0.02)
        .on("tick", ticked)
        .alpha(0.3);

    let currentYearIndex = 0;
    let bubbleData = prepareYearData(years[currentYearIndex]);

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("font-size", "14px")
        .style("z-index", 1000);

    let bubbles = bsvg
        .selectAll(".bubble")
        .data(bubbleData, (d) => d.id)
        .join("circle")
        .attr("class", "bubble")
        .attr("r", (d) => radiusScale(d.hpi))
        .attr("fill", (d) => REGION_COLORS[d.region])
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke-width", 3)
                .attr("opacity", 1);
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.name}</strong><br/>
                    HPI: ${d.hpi.toFixed(2)}<br/>
                    Region: ${d.region.charAt(0).toUpperCase() + d.region.slice(1)}
                `);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("stroke-width", 1)
                .attr("opacity", 0.8);
            
            tooltip.style("opacity", 0);
        });

    let labels = bsvg
        .selectAll(".bubble-label")
        .data(bubbleData, (d) => d.id)
        .join("text")
        .attr("class", "bubble-label")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "700")
        .attr("pointer-events", "none")
        .attr("fill", "white")
        .style("text-shadow", "1px 1px 2px black")
        .text((d) => d.abbr);

    simulation.nodes(bubbleData);

    bsvg
        .append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .style("font-weight", "bold")
        .attr("id", "bubble-title")
        .text(`US Housing Price Index Bubble Chart By State - ${years[currentYearIndex]}`);

    const bubbleLegend = bsvg.append("g")
        .attr("transform", `translate(${width - 120}, 20)`);

    REGION_LIST.forEach((region, i) => {
        const g = bubbleLegend.append("g")
            .attr("transform", `translate(0, ${i * 30})`);

        g.append("circle")
            .attr("cx", 10)
            .attr("cy", 10)
            .attr("r", 10)
            .attr("fill", REGION_COLORS[region])
            .attr("stroke", "black");

        g.append("text")
            .attr("x", 26)
            .attr("y", 15)
            .style("font-size", "14px")
            .text(region.charAt(0).toUpperCase() + region.slice(1));
    });

    const slider = d3.select("#yearSlider")
        .attr("min", 0)
        .attr("max", years.length - 1)
        .attr("value", 0)
        .on("input", function() {
            currentYearIndex = +this.value;
            updateBubbles(years[currentYearIndex]);
            d3.select("#currentYear").text(years[currentYearIndex]);
        });

    d3.select("#currentYear").text(years[0]);

    let animationInterval = null;
    let setPlaying = false;

    d3.select("#playButton").on("click", function() {
        if (setPlaying) {
            clearInterval(animationInterval);
            d3.select(this).text("Play");
            setPlaying = false;
        } 
        else {
            d3.select(this).text("Pause");
            setPlaying = true;
            animationInterval = setInterval(() => {
                currentYearIndex++;
                if (currentYearIndex >= years.length) {
                    currentYearIndex = 0;
                }
                slider.property("value", currentYearIndex);
                updateBubbles(years[currentYearIndex]);
                d3.select("#currentYear").text(years[currentYearIndex]);
            }, 200);
        }
    });

    function updateBubbles(year) {

        const oldPositions = new Map();
        bubbleData.forEach(d => {
            oldPositions.set(d.id, { x: d.x, y: d.y });
        });

        bubbleData = prepareYearData(year);
        
        bubbleData.forEach(d => {
            const oldPos = oldPositions.get(d.id);
            if (oldPos) {
                d.x = oldPos.x;
                d.y = oldPos.y;
            }
        });

        bsvg.select("#bubble-title").text(`US Housing Price Index Bubble Chart By State - ${year}`);
        
        bubbles = bsvg.selectAll(".bubble").data(bubbleData, (d) => d.id);
        bubbles.transition().duration(200).attr("r", (d) => radiusScale(d.hpi));

        labels = bsvg.selectAll(".bubble-label").data(bubbleData, (d) => d.id);

        simulation.nodes(bubbleData);
        simulation.force("collision").radius((d) => radiusScale(d.hpi) + 2);
        simulation.alpha(0.1).restart();
    }

    function ticked() {
        bubbles.attr("cx", (d) => {
            const radius = radiusScale(d.hpi);
            d.x = Math.max(radius, Math.min(width - radius, d.x)); 
            return d.x;
        })
        .attr("cy", (d) => {
            const radius = radiusScale(d.hpi);
            d.y = Math.max(radius, Math.min(height - radius, d.y)); 
            return d.y;
        });

        labels.attr("x", (d) => d.x).attr("y", (d) => d.y + 4);
    }
}

let selectedYear = 2001;

window.addEventListener("load", function () {
    getSelectedYearsData(selectedYear);

    const buttons = document.getElementsByClassName("yearbtn");
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].onclick = function () {
            selectedYear = parseInt(this.id);
            console.log("selected:", selectedYear);
            getSelectedYearsData(selectedYear);
        };
    }
});

function getSelectedYearsData(pickedYear){
    Promise.all([
        d3.csv("hpi_final_agg.csv"),
        d3.csv("cpi_aggregate.csv")
    ]).then(([hpiRaw, cpiRaw]) => {
                    
        hpiRaw.forEach(d => {
            d.yr = +d.yr;
            d.hpi_agg = +d.hpi_agg;
        });

        cpiRaw.forEach(d => {
            d.year = +d.year;
            d.CPI_agg = +d.CPI_agg;
        });

        const selectedYearLocal = pickedYear;
        const prevYear = selectedYearLocal - 1;

        const hpiByStateYear = {};

        for (let i = 0; i < hpiRaw.length; i++) {
            const row = hpiRaw[i];

            const state = row.place_id;
            const year = row.yr;
            const hpiValue = row.hpi_agg;
            const fullName = row.place_name;

            const key = state + "_" + year;

            hpiByStateYear[key] = {
                value: hpiValue,
                name: fullName
            };
        }

        const cpiByYear = {};
        cpiRaw.forEach(d => {
            cpiByYear[d.year] = d.CPI_agg;
        });

        const cpiCurr = cpiByYear[selectedYearLocal];
        const cpiPrev = cpiByYear[prevYear];

        if (cpiCurr == null || cpiPrev == null) {
            console.warn("no CPI data for selected year or previous year");
            return;
        }

        const cpiChange = (cpiCurr - cpiPrev) / cpiPrev;

        const moreAffordable = [];
        const lessAffordable = [];

        const statesThisYear = hpiRaw.filter(d => d.yr === selectedYearLocal);

        for (let i = 0; i < statesThisYear.length; i++) {

            const d = statesThisYear[i];      
            const stateCode = d.place_id;
            const stateName = d.place_name;

            const keyCurr = stateCode + "_" + selectedYearLocal;
            const keyPrev = stateCode + "_" + prevYear;

            const currObj = hpiByStateYear[keyCurr];
            const prevObj = hpiByStateYear[keyPrev];

            if (!currObj || !prevObj || prevObj.value === 0) {
                continue; 
            }

            const currHpi = currObj.value;
            const prevHpi = prevObj.value;

            const hpiChange = (currHpi - prevHpi) / prevHpi;

            const stateNode = {
                name: stateCode,
                fullName: stateName,
                value: currHpi,
                hpiChange: hpiChange,
                cpiChange: cpiChange
            };

            if (hpiChange <= cpiChange) {
                moreAffordable.push(stateNode);
            } else {
                lessAffordable.push(stateNode);
            }
        }

        const treeMapReady = {
            name: "States",
            children: [
                {
                    name: "More affordable",
                    children: moreAffordable
                },
                {
                    name: "Less affordable",
                    children: lessAffordable
                }
            ]
        };

        makeTreeMap(treeMapReady, selectedYearLocal);
    });
}

// based off of the HW3 demo/instructions
// reference: https://d3-graph-gallery.com/graph/treemap_custom.html
function makeTreeMap(treeMapReady, yearLabel) {

    d3.select("#treemap_svg").selectAll("*").remove();

    const marginLocal = {top: 10, right: 10, bottom: 10, left: 10};
    const widthLocal = 580 - marginLocal.left - marginLocal.right;
    const heightLocal = 400 - marginLocal.top - marginLocal.bottom;

    const svgLocal = d3.select("#treemap_svg")
        .attr("width", 580)
        .attr("height", 400);
        
    svgLocal.append("text")
        .attr("x", 10)
        .attr("y", 18)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Treemap for: " + yearLabel);

    const g = svgLocal.append("g")
        .attr("transform","translate(" + marginLocal.left + "," + marginLocal.top + ")");

    const goodData = treeMapReady;

    const root = d3.hierarchy(goodData).sum(function(d){ return d.value; });

    const tooltip = d3.select("#tooltip");

    d3.treemap()
        .size([widthLocal, heightLocal])
        .paddingTop(5)
        .paddingRight(2)
        .paddingInner(2)
        (root);

    // green affordable, red less affordable
    const color = d3.scaleOrdinal()
        .domain(["More affordable", "Less affordable"])
        .range(["#4CAF50", "#F44336"]);  

    const values = root.leaves().map(function(d) { return d.data.value; });
    const vExt = d3.extent(values);
    const vmin = vExt[0];
    const vmax = vExt[1];
    const opacity = d3.scaleLinear()
        .domain([vmin, vmax])
        .range([0.6, 1])
        .clamp(true);

    g.selectAll("rect")
        .data(root.leaves())
        .enter()
        .append("rect")
        .attr('x', function (d) { return d.x0; })
        .attr('y', function (d) { return d.y0; })
        .attr('width', function (d) { return d.x1 - d.x0; })
        .attr('height', function (d) { return d.y1 - d.y0; })
        .style("stroke", "black")
        .style("stroke-width", "1px")
        .style("fill", function(d){ return color(d.parent.data.name); })
        .style("opacity", function(d){ return opacity(d.data.value); })
        .on("mouseover", function (event, d) {
            tooltip.transition().duration(100).style("opacity", 1);
            tooltip.html(
              `State: ${d.data.fullName} (${d.data.name})<br/>` +
              `HPI change: ${(d.data.hpiChange * 100).toFixed(1)}%<br/>` +
              `CPI change: ${(d.data.cpiChange * 100).toFixed(1)}%<br/>` +
              `Affordability: ${d.parent.data.name}`
            );
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(100).style("opacity", 0);
        })
        .on("click", function (event, d) {
            const c = d.data.name;
            console.log("clicked state:", c);
        });
}