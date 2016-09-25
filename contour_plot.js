(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define('contour_plot', ['exports'], factory) :
    factory((global.contour_plot = {}));
}(this, function (exports) { 'use strict';

    /** finds the zeros of a function, given two starting points (which must
     * have opposite signs */
    function bisect(f, a, b, parameters) {
        parameters = parameters || {};
        var maxIterations = parameters.maxIterations || 100,
            tolerance = parameters.tolerance || 1e-10,
            fA = f(a),
            fB = f(b),
            delta = b - a;

        if (fA * fB > 0) {
            throw "Initial bisect points must have opposite signs";
        }

        if (fA === 0) return a;
        if (fB === 0) return b;

        for (var i = 0; i < maxIterations; ++i) {
            delta /= 2;
            var mid = a + delta,
                fMid = f(mid);

            if (fMid * fA >= 0) {
                a = mid;
            }

            if ((Math.abs(delta) < tolerance) || (fMid === 0)) {
                return mid;
            }
        }
        return a + delta;
    }

    // This file is modified from the d3.geom.contour
    // plugin found here https://github.com/d3/d3-plugins/tree/master/geom/contour

    /*
    Copyright (c) 2012-2015, Michael Bostock
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this
      list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.

    * The name Michael Bostock may not be used to endorse or promote products
      derived from this software without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
    DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
    INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
    OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
    NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
    EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */

    function d3_contour(grid, start) {
      var s = start || d3_geom_contourStart(grid), // starting point
          c = [],    // contour polygon
          x = s[0],  // current x position
          y = s[1],  // current y position
          dx = 0,    // next x direction
          dy = 0,    // next y direction
          pdx = NaN, // previous x direction
          pdy = NaN, // previous y direction
          i = 0;

      do {
        // determine marching squares index
        i = 0;
        if (grid(x-1, y-1)) i += 1;
        if (grid(x,   y-1)) i += 2;
        if (grid(x-1, y  )) i += 4;
        if (grid(x,   y  )) i += 8;

        // determine next direction
        if (i === 6) {
          dx = pdy === -1 ? -1 : 1;
          dy = 0;
        } else if (i === 9) {
          dx = 0;
          dy = pdx === 1 ? -1 : 1;
        } else {
          dx = d3_geom_contourDx[i];
          dy = d3_geom_contourDy[i];
        }

        // update contour polygon
        if (dx != pdx && dy != pdy) {
          c.push([x, y]);
          pdx = dx;
          pdy = dy;
        } else {
          c.push([x, y]);
        }

        x += dx;
        y += dy;
      } while (s[0] != x || s[1] != y);

      return c;
    }

    // lookup tables for marching directions
    var d3_geom_contourDx = [1, 0, 1, 1,-1, 0,-1, 1,0, 0,0,0,-1, 0,-1,NaN];
    var d3_geom_contourDy = [0,-1, 0, 0, 0,-1, 0, 0,1,-1,1,1, 0,-1, 0,NaN];
    function d3_geom_contourStart(grid) {
      var x = 0,
          y = 0;

      // search for a starting point; begin at origin
      // and proceed along outward-expanding diagonals
      while (true) {
        if (grid(x,y)) {
          return [x,y];
        }
        if (x === 0) {
          x = y + 1;
          y = 0;
        } else {
          x = x - 1;
          y = y + 1;
        }
      }
    }

    function isoline(f, value, xScale, yScale) {
        var xRange = xScale.range(), yRange = yScale.range();
        return function(x, y) {
            if ((x < xRange[0]) || (x > xRange[1]) ||
                (y < yRange[0]) || (y > yRange[1])) return false;
            return f(xScale.invert(x), yScale.invert(y)) < value;
        };
    }

    function smoothPoints(f, points, level, xScale, yScale) {
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

    function getLogLevels(f, xScale, yScale, count) {
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

    function getContours(f, xScale, yScale, count) {
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

    function ContourPlot() {
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

    var version = "0.0.1";

    exports.version = version;
    exports.isoline = isoline;
    exports.smoothPoints = smoothPoints;
    exports.getLogLevels = getLogLevels;
    exports.getContours = getContours;
    exports.ContourPlot = ContourPlot;

}));