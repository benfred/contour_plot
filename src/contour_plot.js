import {default as bisect} from "./bisect";
import {default as d3_contour} from "./d3_geom_contour";

export function isoline(f, value, xScale, yScale) {
    var xRange = xScale.range(), yRange = yScale.range();
    return function(x, y) {
        if ((x < xRange[0]) || (x > xRange[1]) ||
            (y < yRange[0]) || (y > yRange[1])) return false;
        return f(xScale.invert(x), yScale.invert(y)) < value;
    };
}

export function smoothPoints(f, points, level, xScale, yScale) {
    var xRange = xScale.range(), yRange = yScale.range();
    var ySmooth = function(y) {
        return f(xScale.invert(x), yScale.invert(y)) - level;
    };
    var xSmooth = function(x) {
        return f(xScale.invert(x), yScale.invert(y)) - level;
    };
    for (var k = 0; k < points.length; ++k) {
        var point = points[k], 
            x = point[0], y = point[1];

        if ((x <= xRange[0]) || (x >= xRange[1]) ||
            (y <= yRange[0]) || (y >= yRange[1])) continue;

        var currentSmooth = ySmooth(y);

        var p = {'maxIterations' : 9};
        for (var delta = 0.5; delta <= 3; delta += 0.5) {
            if (ySmooth(y - delta) * currentSmooth < 0) {
                y = bisect(ySmooth, y, y - delta, p); 
            } else if (xSmooth(x - delta) * currentSmooth < 0) {
                x = bisect(xSmooth, x, x - delta, p); 
            } else if (ySmooth(y + delta) * currentSmooth < 0) {
                y = bisect(ySmooth, y, y + delta, p); 
            } else if (xSmooth(x + delta) * currentSmooth < 0) {
                x = bisect(xSmooth, x, x + delta, p); 
            } else {
                continue;
            }
            break;
        }

        point[0] = x;
        point[1] = y;
    }
}

export function getLogLevels(f, xScale, yScale, count) {
    var xRange = xScale.range(), yRange = yScale.range();

    count = count || 12;
   
    // figure out min/max values by sampling pointson a grid
    var maxValue, minValue, value;
    maxValue = minValue = f(xScale.invert(xRange[0]), yScale.invert(yRange[0]));
    for (var y = yRange[0]; y < yRange[1]+1; ++y) {
        for (var x = xRange[0]; x < xRange[1]+1; ++x) {
            value = f(xScale.invert(x),yScale.invert(y));
            minValue = Math.min(value, minValue);
            maxValue = Math.max(value, maxValue);
        }
    }

    // convert 
    var levelScale = d3.scaleLog()
        .domain([1, maxValue - minValue])
        .range([0, count]);
    var levels = [];
    for (var i = count; i > 0; --i) {
        levels.push(minValue + levelScale.invert(i) - 1);
    }

    return levels;
}

export function getContours(f, xScale, yScale, count) {
    // figure out even distribution in log space of values
    var levels = getLogLevels(f, xScale, yScale, count);

    // use marching squares algo from d3.geom.contour to build up a series of paths
    // note: this only handles a single minima
    var ret = [];
    for (var i = 0; i < levels.length; ++i) {
        var level = levels[i];
        var lineFunc = isoline(f, level, xScale, yScale);
        var points = d3_contour(lineFunc);
        smoothPoints(f, points, level, xScale, yScale);
        ret.push(points);
    }

    // return the contours
    return {'paths': ret, 'levels': levels};
}

export function ContourPlot() {
    var drawAxis = false,
        f = function (x, y) { return (1 - x) * (1 - x) + 100 * (y - x * x) * ( y - x * x); },
        colourRange = ["white", "green"],
        yDomain = [3, -3],
        xDomain = [-2, 2];

    // todo: resolution independent (sample say 200x200)
    // todo: handle function with multiple local minima

    function chart(selection) {
        var width = selection.nodes()[0].offsetWidth,
            height = width * 0.75,
            padding = (drawAxis) ? 24 : 0,
            yScale = d3.scaleLinear()
                            .range([padding, height - padding])
                            .domain(yDomain),

            xScale = d3.scaleLinear()
                        .range([padding, width - padding])
                        .domain(xDomain);

        // create tooltip  if doesn't exist
        d3.select("body").selectAll(".contour_tooltip").data([0]).enter()
            .append("div")
            .attr("class", "contour_tooltip")
            .style("font-size", "12px")
            .style("position", "absolute")
            .style("text-align", "center")
            .style("width", "128px")
            .style("height", "32px")
            .style("background", "#333")
            .style("color", "#ddd")
            .style("padding", "0px")
            .style("border", "0px")
            .style("border-radius", "8px")
            .style("opacity", "0");

        var tooltip = d3.selectAll(".contour_tooltip");
            
        // create the svg element if it doesn't already exist
        selection.selectAll("svg").data([0]).enter().append("svg");
        var svg = selection.selectAll("svg").data([0]);

        svg.attr("width", width)
           .attr("height", height)
           .on("mouseover", function() {
                tooltip.transition().duration(400).style("opacity", 0.9);
            })
           .on("mousemove", function() {
                var point = d3.mouse(this), 
                    x = xScale.invert(point[0]),
                    y = yScale.invert(point[1]),
                    fx = f(x, y);

                tooltip.style("left", (d3.event.pageX) + "px")
                       .style("top", (d3.event.pageY - 44) + "px");

                tooltip.html("x = " + x.toFixed(2) + " y = " + y.toFixed(2) + "<br>f(x,y) = " + fx.toFixed(2) );
            })

           .on("mouseout", function() {
                tooltip.transition().duration(400).style("opacity", 0);
           });

        var contours = getContours(f, xScale, yScale);
        var paths = contours.paths,
            levels = contours.levels;

        var colours = d3.scaleLinear().domain([0, levels.length]).range(colourRange);

        var line = d3.line()
            .x(function(d) { return d[0]; })
            .y(function(d) { return d[1]; });

        var pathGroup = svg.append("g");

        pathGroup.selectAll("path").data(paths).enter()
            .append("path")
            .attr("d", function(d) { return line(d) + " Z";})
            .style("fill", function(d, i) { return colours(i); })
            .style("stroke-width", 1.5)
            .style("stroke", "white")
            .on("mouseover", function() {
                d3.select(this).style("stroke-width", "4");
            })
            .on("mouseout", function() {
                d3.select(this).style("stroke-width", "1.5");
           });

        // draw axii
        if (drawAxis) {
            var xAxis = d3.axisBottom().scale(xScale),
                yAxis = d3.axisLeft().scale(yScale);
            
            svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(0," + (height - 1.0 *  padding) + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(" + (padding) + ",0)")
                .call(yAxis);
        }

        return {'xScale' : xScale, 'yScale' : yScale, 'svg' : svg};
    }
    chart.drawAxis = function(_) {
        if (!arguments.length) return drawAxis;
        drawAxis = _;
        return chart;
    };

    chart.xDomain = function(_) {
        if (!arguments.length) return xDomain;
        xDomain = _;
        return chart;
    };

    chart.yDomain = function(_) {
        if (!arguments.length) return yDomain;
        yDomain = _;
        return chart;
    };

    chart.colourRange = function(_) {
        if (!arguments.length) return colourRange;
        colourRange = _;
        return chart;
    };

    chart.f = function(_) {
        if (!arguments.length) return f;
        f = _;
        return chart;
    };

    return chart;
}
