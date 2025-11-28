// structure for page
const margin = { top: 60, right: 180, bottom: 60, left: 70 };
const width  = 1100 - margin.left - margin.right;
const height = 600  - margin.top  - margin.bottom;

// buttons for treemap
let selectedYear = 2001;

window.onload = function () {
    // default load
    getSelectedYearsData(2001);
    let buttons = document.getElementsByClassName("yearbtn");
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].onclick = function () {
            selectedYear = parseInt(this.id);
            console.log("selected:", selectedYear);
            getSelectedYearsData(selectedYear);
        };
    }
};

const svg = d3.select("#chart")
    .append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);


// defines the regions of the usa. I used a pdf from a government website
// so if anyone has an issue with how the regions are defined, feel free to
// change it and just let everyone know so we can all decide
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

function rollingAverage(arr, windowSize=3) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize/2));
        const end = Math.min(arr.length, i + Math.floor(windowSize/2));
        const slice = arr.slice(start, end+1);
        result.push(d3.mean(slice));
    }
    return result;
}

// load and process the hpi data
d3.csv("hpi_master.csv").then(hpi => {

    // Parse columns of dataset
    hpi.forEach(d => {
        d.yr = +d.yr;
        d.period = +d.period;
        d.index_sa = +d.index_sa;

        // Creates date to organize chronologically
        d.date = new Date(d.yr, d.period - 1, 1);
    });

    // Use only Census Division rows for most basic region
    // this category is basically what makes up the four quadrants of the us.
    // going forward we will need to use the individual states of course.
    const divisionRows = hpi.filter(d => d.level === "USA or Census Division");

    // Group by date
    const byDate = d3.group(divisionRows, d => +d.date);

    // Build regions based data
    const regionSeries = [];

    for (const [ts, rows] of byDate.entries()) {
        const date = new Date(ts);
        const row = { date };

        for (const region of REGION_LIST) {
            const vals = rows
                .filter(r => DIVISION_TO_REGION[r.place_name] === region)
                .map(r => r.index_sa);

            row[region] = vals.length ? d3.mean(vals) : null;
        }

        regionSeries.push(row);
    }

    // sort by date
    regionSeries.sort((a, b) => a.date - b.date);

// Average out the data year over year to make the graph actually look good
const yearlyMap = d3.group(regionSeries, d => d.date.getFullYear());

const yearlySeries = [];

yearlyMap.forEach((rows, year) => {
    // Use Jan 1 as the timestamp for that year
    const date = new Date(+year, 0, 1);

    const obj = { date };

    REGION_LIST.forEach(region => {
        const values = rows.map(r => r[region]);
        obj[region] = d3.mean(values);
    });

    yearlySeries.push(obj);
});

// Replace monthly data with yearly data
regionSeries.length = 0;
yearlySeries.sort((a, b) => a.date - b.date)
    .forEach(d => regionSeries.push(d));


    // scale for x axis
    const x = d3.scaleTime()
    .domain([new Date(1989, 0, 1), d3.max(regionSeries, d => d.date)])
    .range([0, width]);


    const stack = d3.stack()
        .keys(REGION_LIST)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const stackedData = stack(regionSeries);

    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(stackedData[stackedData.length - 1], d => d[1])
        ])
        .range([height, 0]);

    // Area generator
    const area = d3.area()
        .x(d => x(d.data.date))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    // Draws in the areas
    svg.selectAll(".layer")
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", "layer")
        .attr("d", area)
        .attr("fill", d => REGION_COLORS[d.key])
        .attr("stroke", "black")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.9);

    // xyaxis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(6).tickPadding(8));

    svg.append("g")
        .call(d3.axisLeft(y));

    // title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .style("font-weight", "bold")
        .text("US Housing Price Index — Regions Over Time");

    // legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 20}, 20)`);

    REGION_LIST.forEach((region, i) => {
        const g = legend.append("g")
            .attr("transform", `translate(0, ${i * 30})`);

        g.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .attr("fill", REGION_COLORS[region])
            .attr("stroke", "black");

        g.append("text")
            .attr("x", 26)
            .attr("y", 15)
            .style("font-size", "14px")
            .text(region.charAt(0).toUpperCase() + region.slice(1));
    });
});

// get data based on selected button (default loads 2001)
function getSelectedYearsData(pickedYear){
    // load and process the aggregated hpi/cpi data
    Promise.all([d3.csv("hpi_final_agg.csv"),
                d3.csv("cpi_aggregate.csv")
                ]).then(([hpiRaw, cpiRaw]) => {
                    
        // parse hpi csv for calcs
        hpiRaw.forEach(d => {
            d.yr = +d.yr;
            d.hpi_agg = +d.hpi_agg;
        });

        // parse cpi csv for calcs
        cpiRaw.forEach(d => {
            d.year = +d.year;
            d.CPI_agg = +d.CPI_agg;
        });

        // change this to a dropdown or make into a selectable table?
        //const selectedYear = 2004;   // UPDATE
        //DEBUG
        //console.log(pickedYear);
        const selectedYear = pickedYear;
        const prevYear = selectedYear - 1;

        // table to hold hpi per state for selected year 
        var hpiByStateYear = {};

        // loop through every row in csv and build table
        for (var i = 0; i < hpiRaw.length; i++) {
            var row = hpiRaw[i];

            var state = row.place_id;
            var year = row.yr;
            var hpiValue = row.hpi_agg;
            var fullName = row.place_name;

            // unique key in for storing in table
            var key = state + "_" + year;

            hpiByStateYear[key] = {
                value: hpiValue,
                name: fullName
            };
        }

        
        const cpiByYear = {};
        // loop through each row and save cpi value
        cpiRaw.forEach(d => {
            // year will return cpi value respectively
            cpiByYear[d.year] = d.CPI_agg;
        });

        // get cpi for current year and prev year for calculations
        const cpiCurr = cpiByYear[selectedYear];
        const cpiPrev = cpiByYear[prevYear];

        // sanity check
        if (cpiCurr == null || cpiPrev == null) {
            console.warn("no CPI data for selected year or previous year");
            return;
        }

        // calculates if the cpi increased (less aff.) or decreased (more aff.)
        const cpiChange = (cpiCurr - cpiPrev) / cpiPrev;

        // arrays for more/less affordable
        const moreAffordable = [];
        const lessAffordable = [];

        // find all states that exist in the selected year
        const statesThisYear = hpiRaw.filter(d => d.yr === selectedYear);

        // loop through all states in the year
        for (var i = 0; i < statesThisYear.length; i++) {

            // first row
            var d = statesThisYear[i];      
            var stateCode = d.place_id;
            var stateName = d.place_name;

            var keyCurr = stateCode + "_" + selectedYear;
            var keyPrev = stateCode + "_" + prevYear;

            // get values from the hpi table 
            var currObj = hpiByStateYear[keyCurr];
            var prevObj = hpiByStateYear[keyPrev];

            // verify both years exist
            if (!currObj || !prevObj || prevObj.value === 0) {
                continue; 
            }

            var currHpi = currObj.value;
            var prevHpi = prevObj.value;

            // calculate percent change in hpi
            var hpiChange = (currHpi - prevHpi) / prevHpi;

            // object for current state
            var stateNode = {
                name: stateCode,
                fullName: stateName,
                value: currHpi,
                hpiChange: hpiChange,
                cpiChange: cpiChange
            };

            if (hpiChange <= cpiChange) {
                // push state to affordable array
                moreAffordable.push(stateNode);
            } else {
                // push state to less affordable array
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

        // data ready to make treemap
        makeTreeMap(treeMapReady);
    });
};

// based off of the HW3 demo/instructions
// reference: https://d3-graph-gallery.com/graph/treemap_custom.html
function makeTreeMap(treeMapReady) {

    // empty before each run
    d3.select("#treemap_svg").selectAll("*").remove();

    // set the dimensions and margins of the graph
    var margin = {top: 10, right: 10, bottom: 10, left: 10};
    const width = 580 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select("#treemap_svg")
        .attr("width", 580)
        .attr("height", 400)
        
    svg.append("text")
            .attr("x",10)
            .attr("y",10)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text("Treemap for: " + selectedYear);
    var g = svg.append("g")
        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    // use the data we built
    var goodData = treeMapReady;

    // Give the data to this cluster layout:
    var root = d3.hierarchy(goodData).sum(function(d){ return d.value });

    // mouse hover functionality
    var tooltip = d3.select("#tooltip");

    // Then d3.treemap computes the position of each element of the hierarchy
    d3.treemap()
        .size([width, height])
        .paddingTop(5)
        .paddingRight(2)
        .paddingInner(2)
        (root);

    // green affordable, red less affordable
    var color = d3.scaleOrdinal()
        .domain(["More affordable", "Less affordable"])
        .range(["#4CAF50", "#F44336"]);  

    // adjust opacity scale based on the ranges in the categories
    var values = root.leaves().map(function(d) { return d.data.value; });
    var vExt = d3.extent(values);
    var vmin = vExt[0];
    var vmax = vExt[1];
    var opacity = d3.scaleLinear()
        .domain([vmin, vmax])
        .range([0.6, 1])
        .clamp(true);

    // use this information to add rectangles:
    g
        .selectAll("rect")
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
        // mouse hovering functionality
        .on("mouseover", function (event, d) {
            tooltip.transition().duration(100).style("opacity", 1);
            tooltip.html(
              `State: ${d.data.fullName} (${d.data.name})<br/>` +
              `HPI change: ${(d.data.hpiChange * 100).toFixed(1)}%<br/>` +
              `CPI change: ${(d.data.cpiChange * 100).toFixed(1)}%<br/>` +
              `Affordability: ${d.parent.data.name}`
            );
        })
        // follows mouse
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        // hides it when out of SVG
        .on("mouseout", function () {
            tooltip.transition().duration(100).style("opacity", 0);
        })
        // click handler (optional, you can repurpose or remove)
        .on("click", function (event, d) {
            const c = d.data.name;
            console.log("clicked state:", c);
        });
};

