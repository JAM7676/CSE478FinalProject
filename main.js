// config
const margin = { top: 60, right: 180, bottom: 60, left: 70 };
const width  = 1100 - margin.left - margin.right;
const height = 600  - margin.top  - margin.bottom;

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

    // Parse fields
    hpi.forEach(d => {
        d.yr = +d.yr;
        d.period = +d.period;
        d.index_sa = +d.index_sa;

        // Create date
        d.date = new Date(d.yr, d.period - 1, 1);
    });

    // Use only Census Division rows
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

// converts monthly region data into yearly averages so the graph is less spiky
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

    // fill areas
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

    // axis'
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
