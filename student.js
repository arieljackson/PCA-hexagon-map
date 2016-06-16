/*
  The basic rules for what needs to be availble from this student.js are:

  dataFinish: will be called once at the end of d3.csv()
  choiceSet: will be called with radioButton changes
  toggleState: will be called with clicks on states or their marks

  Beyond that, you can add and re-structure things as you see fit.
  Most of the code below is based on project 2. Places where its
  especially important to add code are marked with "(your code here)"
*/
var StateSel = [];

// trying to use https://toddmotto.com/mastering-the-module-pattern/
var P3=(function () {

/* variable controlling map geometry; you can reduce this if you think
   it will help your depiction of which states are selected, while not
   creating too distracting a boundary between all the states */
var HexScaling = 1.0; // hexagon scaling (1 == touching)

/* radius of circular marks in bivariate case; change this if you
   think it will make things clearer */
var MarkRadius = 5.0;
/* CmapLegSize and PCALegSize are set in index.html since they
   shouldn't be changed */

/* duration, in milliseconds, of transitions between visualizations */
var TransitionDuration = 500;

/* other variables to track current state of visualization */
var CmapUnivariate = false; // is current colormap univariate?
/* you can add variables more here.  For example, how will you keep
   track of whether a state has been selected in the visualization?
   (your code here) */

/* utility functions that should not need changing */
var lerp = function (w,[a,b]) { return (1.0-w)*a + w*b; }
var unlerp = function (x,[x0,x1]) { return (x-x0)/(x1-x0); }
var minmax = function (arr) {
    var minval=arr[0], maxval=minval;
    arr.map(function (x) {
            minval = Math.min(x, minval);
            maxval = Math.max(x, maxval);
        });
    return [minval, maxval];
}


var allzero = function() {
    var arrr = [];
    arrr.length = 51
    return arrr.fill(0)}; 

console.log(allzero());
/* toggleState is called when you click on either a state in the map,
   or its indication in the colormap legend; the passed "state" is the
   two letter state abbreviation.  That means you can select the hexagon
   for the state with d3.select("#" + state + "hex"), and the tickmark
   for the state with d3.select("#" + state + "mark"). How you modify
   the tickmark for the state will probably depend on whether a univariate
   or a bivariate colormap is being used (CmapUnivariate) */
   var toggleState = function(state) {
       var i = StateSel.indexOf(state);
       if (i >= 0) {
          StateSel.splice(i, 1);
          d3.select("#" + state + "hex")
            .attr("stroke-opacity", 0)
          d3.select("#" + state).selectAll("text.stateID")
              .attr("font-weight", "400")
              .style('fill', '#333')
              .style("font-size", "13px")
              .style("text-shadow", 
                "1px 0px 1px #ddd, -1px 0px 1px #ddd, 0px 1px 1px #ddd, 0px -1px 1px #ddd");
          d3.select("#" + state + "mark")
            .attr("stroke", "black");
       }
       else {
          StateSel.push(state);
          d3.select("#" + state + "hex")
            .attr("stroke-opacity", 1)
          d3.select("#" + state).selectAll("text.stateID")
              .attr("font-weight", "900")
              .style("fill", 'white') 
              .style("font-size", "15px")
              .style("text-shadow", 
                "1px 0px 1px #000, -1px 0px 1px #000, 0px 1px 1px #000, 0px -1px 1px #000");
          d3.select("#" + state + "mark")
            .attr("stroke", "white");
       }
       console.log(StateSel);

   }

/* PCA: computes PCA of given array of arrays.
   uses http://www.numericjs.com for linear algebra */
var PCA = function (dcols) {
    if (dcols.length < 3) {
        d3.select("#pcaWarning").html("PCA() needs at least 3 variables (got " + dcols.length+ ")");
        return null;
    }
    /* else got enough variables */
    d3.select("#pcaWarning").html("");
    // dcols: (short) array of (long) data arrays (each element ~ a csv column)
    // drows: (long) array of data vectors (each element ~ a csv row)
    var drows = numeric.transpose(dcols);
    // covar: covariance matrix
    var covar = numeric.dot(dcols,drows);
    /* NOTE: numeric.dot is for matrix multiplication in general,
       which includes matrix-matrix multiply (as above), and
       matrix-vector multiply, as well as
       vector-vector (inner) product, which you might want to use for
       compute coordinates in the basis of PCA eigenvectors */
    // nmeig: numeric.js's eigensystem representation of covar
    var nmeig = numeric.eig(covar);
    /* NOTE: If you see in the javascript console:
       "Uncaught Error: numeric: eigenvalue iteration does not converge -- increase maxiter?"
       then it is likely that one or more values being passed to
       numeric.eig(covar) are not numeric (e.g. "NaN"), which can happen if
       one or more values in dcols are not numeric */
    // evec: array of covariance matrix eigenvectors (unit-length)
    var evec = numeric.transpose(nmeig.E.x);
    // evec: array of corresponding eigenvalues
    var eval = nmeig.lambda.x;
    // esys: zipping up each component of eigensysem into a little object:
    // "l" for eigenvalue, "v" eigenvector, and "mm" for zero-centered range
    // of projections of data into that eigenvector
    var esys = eval.map(function (_,i) {
            var mindot = 0, maxdot = 0;
            drows.map(function (_,j) { // learn range of projections
                    var x = numeric.dot(drows[j],evec[i]);
                    mindot = Math.min(mindot, x);
                    maxdot = Math.max(maxdot, x);
                    // console.log("minmax: " + mindot + " " + maxdot)
                });
            // center range around zero
            var mmin = Math.min(mindot, -maxdot);
            var mmax = Math.max(-mindot, maxdot);
            // make sure the range itself is non-zero
            if (mmin == mmax) {
                mmin = -1;
                mmax = 1;
            }
            return {"l": eval[i],
                    "v": evec[i],
                    // simplify needlessly precise representation of range
                    "mm": [d3.format(".3f")(mmin), d3.format(".3f")(mmax)]};
        });


    // sort eigensystem in descending eigenvalue order
    esys.sort(function (a,b) {
            var x = a.l; var y = b.l;
            return ((x < y) ? 1 : ((x > y) ? -1 : 0));
        });
    console.log(esys[0].mm, esys[1].mm, esys[2].mm);
    return esys;
}

/* dataNorm should take an array of scalar data values and return an
   array resulting from two transformations:
   1) subtract out the mean
   2) make the variance 1
   Making the variance 1 means that no data variable will out an outsized
   influence on the PCA just because of a choice of units: multiplying a
   variable by 10 won't change its information content, but it would
   increase that variable's role in a PCA. */
   /* variance formula - subtract each x_i minus the mean
    * use map to fix the mean
    * then use map to fix variance
    */
var dataNorm = function (arr) {
    // console.log(arr);
    // console.log(arr.length);
    arr = arr.map( function(data) {
      return +data;
    });
    var sum = arr.reduce(function(s, x) { return s + x}, 0);
//     // console.log(sum);
     var mean = sum/(arr.length);
    // console.log(mean);
    var sqrs = arr.map( function(x) { return (x - mean) * (x - mean)});
    var sum_sqrs = sqrs.reduce(function(s, x) { return s + x}, 0);
    var sqrs_mean = sum_sqrs / sqrs.length;
    var std_dev = Math.sqrt(sqrs_mean);
    var fix = arr.map( function(x) { return (x - mean) / std_dev});
    return fix;
}




/* (from Project2 solution) some stuff we can use for each
 * univariate map.  Feel free to ignore/delete this function
 * if you want to structure things differently */
var stuff = function (what, mmGiven) {
    var sel = function(d) {return +d[what]}
    var slc = P3.data.map(sel);
    var mm = ((typeof mmGiven === 'undefined')
              ? minmax(slc) // mmGiven not passed, find min,max
              : mmGiven);   // use given mmGiven
    return {"select" : sel,
            "minmax" : mm,
            "cmlscl" : d3.scale.linear().domain(mm).range([0,P3.CmapLegSize-1]),
            };
}

var dataFinish = function (data) {
    /* save data for future reference (for simplicity, from here on
       out P3.data is the only way we'll refer to the data) */
    P3.data = data;

    /* much of the code here is from Project2 reference solution
       http://people.cs.uchicago.edu/~glk/ class/DataVis/p2.js
       but you should feel free to modify/augment/edit it as you
       see fit for your work (your code here) */
    var voteTotMax = 0;
    P3.data.map(function(d) {
            var VT = +d["ObamaVotes"] + +d["RomneyVotes"];
            d["VT"] = VT;
            d["PL"] = +d["ObamaVotes"]/(1.0 + VT);
            voteTotMax = Math.max(voteTotMax, VT);
        });

        //THIS is an example of how to add fields to P3.data
    P3.data.map(function(d) {
            d["VA"] = 1 - Math.pow(1- d["VT"]/voteTotMax, 3);
        });

    /* learn earnings ranges */
    P3.earnWMinMax = minmax(P3.data.map(function(d) {return +d["WE"]}));
    P3.earnMMinMax = minmax(P3.data.map(function(d) {return +d["ME"]}));

    /* obesity-related things */
    P3.obeseStuff = stuff("OB");
    var _obeseCmap = d3.scale.linear() /* colormap prior to quantization */
        .domain([0,0.4,1])
        .range([d3.rgb(100,200,100), d3.rgb(220,220,210), d3.rgb(130,0,0)]);
    P3.obeseCmap = function(r) {
        var w0 = Math.round(lerp(unlerp(r,P3.obeseStuff["minmax"]), [-0.5, 6.5]));
        return _obeseCmap(unlerp(Math.min(6, w0),[-0.5, 6.5]));
    }

    /* create unemployment colormap */
    P3.unempStuff = stuff("UN");
    P3.unempCmap = d3.scale.linear()
        .domain([0,1/3,2/3,1].map(function(w) {return lerp(w,P3.unempStuff["minmax"]);}))
        .range([d3.rgb(0,0,0), d3.rgb(210,0,0), d3.rgb(255,210,0), d3.rgb(255,255,255)]);

    /* create infant mortality map */
    P3.imortStuff = stuff("IM");
    P3.imortCmap = function(d) {
        var scl = d3.scale.linear().domain(P3.imortStuff["minmax"]);
        return d3.hcl(scl.range([330,-15])(d),
                      25*Math.pow(Math.sin(scl.range([0,3.14159])(d)),2),
                      scl.range([0,100])(d));
    }

    /* create univariate voter maps */
    P3.pleanStuff = stuff("PL", [0,1]);
    var Dhcl = d3.hcl(d3.rgb(0,0,210));
    var Rhcl = d3.hcl(d3.rgb(210,0,0));
    P3.pleanCmap = function(x) {
        return d3.hcl(x < 0.5 ? Rhcl.h : Dhcl.h,
                      (x < 0.5 ? Rhcl.c : Dhcl.c)*
                      (1 - Math.pow(1 - (Math.abs(x-0.5)/0.5),4)),
                      lerp(x,[Rhcl.l,Dhcl.l]));
    }

    /* create bivariate voter map */
    P3.plean2Cmap = function([pl,va]) {
        var col = P3.pleanCmap(pl);
        return d3.hcl(col.h,  lerp(va,[0,col.c]),  lerp(va,[100,col.l]));
    }

    /* create bivariate earnings maps */
    P3.ERcmap = function([mm,ww]) {
        var erw = unlerp(ww,P3.earnWMinMax);
        var erm = unlerp(mm,P3.earnMMinMax);
        return d3.lab(25+40*(erw + erm), 0, 170*(erm - erw));
    }

    /* ADD COLUMNS OF TO DATA */

    P3.OBcol = P3.data.map(function(d)
            {return d["OB"]});
    P3.UNcol = P3.data.map(function(d)
            {return d["UN"]});
    P3.IMcol = P3.data.map(function(d)
            {return d["IM"]});
    P3.PLcol = P3.data.map(function(d)
            {return d["PL"]});
    P3.VAcol = P3.data.map(function(d)
            {return d["VA"]});
    P3.MEcol = P3.data.map(function(d)
            {return d["ME"]});
    P3.WEcol = P3.data.map(function(d)
            {return d["WE"]});
    P3.GScol = P3.data.map(function(d)
            {return d["GS"]});
    P3.FBcol = P3.data.map(function(d)
            {return d["FB"]});
    // console.log(P3.OBcol);

    /* New colormaps that you want to create go here ... */

    P3.testCmap = function() {
        return "aqua";
    }

    //   NOTE: any elements set up in index.html can be modified here,
    //   prior to any calls to choiceSet.  For example, to change the
    //   fill in all the #cmlMarks ellipses to pink, you could:

       d3.select("#cmlMarks").selectAll("ellipse")
         .data(P3.data)
         .attr("stroke", "black");

       //Or, to add zero-opacity white dashed stroke around each state's
       //hexagon (the "path" inside the per-state "g" in "#mapUS"):

       d3.select("#mapUS").selectAll("g").select("path")
         .data(P3.data)
         .attr("stroke", "white")
         .attr("stroke-width", 3)
         // .attr("stroke-dasharray", "7,4")
         .attr("stroke-opacity", 0); //change to 1

}



var choiceSet = function (wat,pvars) {
    console.log(wat,pvars); // feel free to remove this debugging line
    if (wat.startsWith("PC")) {
        if (pvars.length < 1) { 
            d3.select("#pcaWarning").html("Select at least one variable below for PCA");
            return;
        }
        else {
            var pcols = pvars.map(function(d)
                        { return P3[d.concat("col")]});
            // console.log(pcols);
            var dcols = pcols.map(function(d) {return dataNorm(d)});
            // console.log(dcols);
            var drows =  numeric.transpose(dcols);
            if (pvars.length == 1) {
                dcols.push(allzero());
                dcols.push(allzero()); 
            }
            if (pvars.length == 2) {
                dcols.push(allzero());
            }
            var PCA_data = PCA(dcols);
            console.log(PCA_data); //
            P3.data.map(function(d, ii) { //we only care about the first three eigenvectors :D
                        d.PCA_0 = numeric.dot(drows[ii], PCA_data[0].v);
                        d.PCA_1 = numeric.dot(drows[ii], PCA_data[1].v);
                        d.PCA_2 = numeric.dot(drows[ii], PCA_data[2].v);
                        // console.log(d.PCA_0, d.PCA_1, d.PCA_2);
                        })
        }

        P3.PCA0col = P3.data.map(function(d)
            {return d["PCA_0"]});
        P3.PCA1col = P3.data.map(function(d)
            {return d["PCA_1"]});
        P3.PCA2col = P3.data.map(function(d)
            {return d["PCA_2"]});

        /* Else we have at least one variable for PCA; so we do that here,
           in the following steps:
           1) make an array (suppose its called "dcols") of the result
           of calling dataNorm() on each data variable (your code here)
           (can be as little as 3 lines) */
           //select one column of the data //
           //  select normalized based on which three columns (variables)
           //are selected

        /* 2) If less than 3 variables were selected for PCA, add to "dcols"
           one or two arrays of zeros, so that PCA() has at least three
           data variables to work on (your code here) (a few lines) */
           //add arrays of 0's if needed
           //play with whether you need to add the 0 columns first???

        /* 3) call PCA(dcols), and add to P3.data the coordinates of each
           datum in the basis of the first three principle components.

           Note
           that "var drows = numeric.transpose(dcols)" will get you an array
           of per-state data (row) vectors, and then with
           "P3.data.map(function(d,ii) { })" you can set PCA coordinate
           fields in per-state datum "d" from the dot product between
           drows[ii] and the PCA eigenvectors. Visualizing the PCA
           results should use these PCA coordinates in the same way that
           in the previous project you used the original data variables.
           (your code here) (roughly ~20 lines of code) */
           //add some field to data, for 3d subspace, that spanned by
           //eigenvectors u just found, what are the data coordinates in
           //that new basis
           //if u make it take two arguments, its passed the index of
           //that element in the array
           //want to be able to index into the thingy on a per-state basis.
           //will get rows 0 -50 with 3 (p) element
           //PCA returns sorted eigen system components
           //will give me p item objects
           //save this info into P3.data
           //we will have PCA 0,1,2

        /* 4) Visualize what the PCA did with the given data variables inside
           the #pcaMarks svg by changing the text element #pcaXX for
           all variables XX (selected via d3.select("#pca" + XX)):
           a) Make the text opaque for the variables actually included in
           the PCA, and transparent for the rest. */


           /*b) For the variables in PCA, move the text to a position that
           indicates how that variable is aligned with the principle
           component(s) shown (one component for PC0, PC1, PC2, and
           two components for PC01, PC02, PC12). Compute this by forming
           a vector of length pvars.length which is all 0s except for 1 at
           the index of XX in pvars, and then using numeric.dot() to get
           the dot product with a principle component eigenvector. Since
           this is the dot product of two unit-length vectors, the result
           should be in [-1,1], which you should map to coordinates
           [30,P3.PCALegSize-30]) in X or [P3.PCALegSize-30,30]) in Y.
           Text is moved by modifying the "transform" attribute to
           "translate(cx,cy)" for position (cx,cy). For variables not
           in the PCA, the text should be moved back to the center at
           (P3.PCALegSize/2,P3.PCALegSize/2).  You can iterate over the
           #pcaXX with "P3.PCAVars.map(function(XX) { })".
           Changes to both opacity and position should also be made via a
           transition of duration TransitionDuration.  (your code here)
           (roughly ~30 lines of code) */

           P3.PCAVars.map(function(v) {
               d3.select("#pca" + v)
                 .transition()
                   .duration(TransitionDuration)
                   .attr("opacity", "0")
                   .attr("transform", "translate(" + (P3.PCALegSize/2) + "," + (P3.PCALegSize/2) + ")")
              if (pvars.indexOf(v) == -1) {
                d3.select("#pca" + v)
                  .transition()
                    .duration(TransitionDuration)
                    .attr("opacity", "0")
                    .attr("transform", "translate(" + (P3.PCALegSize/2) + "," + (P3.PCALegSize/2) + ")")
              } else {
                var pv = [];
                pv.length = pvars.length
                pv.fill(0)
                i = pvars.indexOf(v);
                pv[i] = 1;
                y = (P3.PCALegSize/2)

                switch (wat) {
                  case "PC0":
                    pcx = PCA_data[0].v;
                    break;
                  case "PC1":
                    pcx = PCA_data[1].v
                    break;
                  case "PC2":
                    pcx = PCA_data[2].v
                    break;
                  case "PC01":
                    pcx = PCA_data[0].v;
                    pcy = PCA_data[1].v;
                    break;
                  case "PC02":
                    pcx = PCA_data[0].v;
                    pcy = PCA_data[2].v;
                    break;
                  case "PC12":
                    pcx = PCA_data[1].v;
                    pcy = PCA_data[2].v;
                    break;
                }

                dotpx = numeric.dot(pv, pcx);
                console.log("dot product: " + dotpx + "var is :" +v);
                x = lerp(unlerp(dotpx, [-1, 1]), [30,P3.PCALegSize-30]);

                if (wat == "PC01" || wat == "PC02" || wat == "PC12") {
                  dotpy = numeric.dot(pv, pcy);
                  console.log("dot product: " + dotpy);
                  y = lerp(unlerp(dotpy, [-1, 1]), [P3.PCALegSize-30,30]);
                }
                console.log("x = " + x); console.log("y =" + y);
                console.log(P3.PCALegSize/2);
                d3.select("#pca" + v)
                  .transition()
                    .duration(TransitionDuration)
                    .attr("opacity", "1")
                    .attr("transform", "translate(" + x + "," + y + ")")
               }
             })

            
            /* COLORMAPS */
            P3.PCA_0_stf = stuff("PCA_0", PCA_data[0].mm);
            P3.PCA_1_stf = stuff("PCA_1", PCA_data[1].mm);
            P3.PCA_2_stf = stuff("PCA_2", PCA_data[2].mm);

            P3.univCmap_0 = d3.scale.linear()
                .domain([PCA_data[0].mm[0], 0, PCA_data[0].mm[1]])
                .range(["mediumvioletred", "gray", "green"])
                .interpolate(d3.interpolateLab);
            P3.univCmap_1 = d3.scale.linear()
                .domain([PCA_data[1].mm[0], 0, PCA_data[1].mm[1]])
                .range(["mediumvioletred", "gray", "green"])
                .interpolate(d3.interpolateLab);
            P3.univCmap_2 = d3.scale.linear()
                .domain([PCA_data[2].mm[0], 0, PCA_data[2].mm[1]])
                .range(["mediumvioletred", "gray", "green"])
                .interpolate(d3.interpolateLab);

            P3.bivCmap_01 = function([p0,p1]) {
                var x = unlerp(p0,PCA_data[0].mm);
                var y = unlerp(p1,PCA_data[1].mm);
                return d3.lab(15+40*(x + y), 15*(x-y), 180*(x - y));
              }

            P3.bivCmap_02 = function([p0,p2]) {
                var x = unlerp(p0,PCA_data[0].mm);
                var y = unlerp(p2,PCA_data[2].mm);
                return d3.lab(15+40*(x + y), 15*(x-y), 180*(x - y));
              }

            P3.bivCmap_12 = function([p1,p2]) {
                var x = unlerp(p1,PCA_data[1].mm);
                var y = unlerp(p2,PCA_data[2].mm);
                return d3.lab(15+40*(x + y), 15*(x-y), 180*(x - y));
              }

    } else {
        d3.select("#pcaWarning").html("");
        /* else this isn't a PCA visualization, so none of the
           variables are involved in the PCA, so re-center all the PCA
           marks and make them transparent (your code here) (~10 lines) */
        P3.PCAVars.map(function(v) {
          d3.select("#pca" + v)
            .transition()
              .duration(TransitionDuration)
              .attr("opacity", "0")
              .attr("transform", "translate(" + (P3.PCALegSize/2) + "," + (P3.PCALegSize/2) + ")")
        })

    }

    /* is this a univariate map? */
    CmapUnivariate = (["OB", "UN", "IM", "VU", "PC0", "PC1", "PC2"].indexOf(wat) >= 0);
    
    /* set the colormapping function */
    var colormap = {"OB" : P3.obeseCmap,
                    "UN" : P3.unempCmap,
                    "IM" : P3.imortCmap,
                    "VU" : P3.pleanCmap,
                    "VB" : P3.plean2Cmap,
                    "ER" : P3.ERcmap,
                    "PC0": P3.univCmap_0,
                    "PC1": P3.univCmap_1,
                    "PC2": P3.univCmap_2,
                    "PC01": P3.bivCmap_01,
                    "PC12": P3.bivCmap_12,
                    "PC02": P3.bivCmap_02,
    }[wat];
    var cml, cmlx, cmly, sel, mmx, mmy;
    // console.log(P3.PCA0col, PCA_data[0].mm)
    if (CmapUnivariate) {
        var stf = {"OB" : P3.obeseStuff,
                   "UN" : P3.unempStuff,
                   "IM" : P3.imortStuff,
                   "VU" : P3.pleanStuff,
                   "PC0": P3.PCA_0_stf,
                   "PC1": P3.PCA_1_stf,
                   "PC2": P3.PCA_2_stf,
        }[wat];
        [cml,mmx,sel] = [stf["cmlscl"], stf["minmax"], stf["select"]];
        console.log(stf);
        mmy = null;
    } else {
        cml = mmx = mmy = sel = null;
    }
    /* handle the bivariate cases */
    switch (wat) {
    case "VB" :
        cmlx = cmly = d3.scale.linear().domain([0, 1]).range([0,P3.CmapLegSize-1]);
        mmx = mmy = [0,1];
        sel = function(d) {return [+d.PL,+d.VA]};
        break;
    case "ER" :
        cmlx = d3.scale.linear().domain(P3.earnMMinMax).range([0,P3.CmapLegSize-1]);
        cmly = d3.scale.linear().domain(P3.earnWMinMax).range([0,P3.CmapLegSize-1]);
        mmx = P3.earnMMinMax;
        mmy = P3.earnWMinMax;
        sel = function(d) {return [+d.ME,+d.WE]};
        break;
    case "PC01":
        mmx = [minmax([PCA_data[0].mm[0], PCA_data[1].mm[0]])[0], 
                minmax([PCA_data[0].mm[1], PCA_data[1].mm[1]])[1]]  
        mmy = [minmax([PCA_data[0].mm[0], PCA_data[1].mm[0]])[0], 
                minmax([PCA_data[0].mm[1], PCA_data[1].mm[1]])[1]]  
        cmlx = d3.scale.linear().domain(mmx).range([0,P3.CmapLegSize-1]);
        cmly = d3.scale.linear().domain(mmy).range([0,P3.CmapLegSize-1]);
        sel = function(d) {return [+d.PCA_0,+d.PCA_1]};
        break;
    case "PC02":
        mmx = [minmax([PCA_data[0].mm[0], PCA_data[2].mm[0]])[0], 
                minmax([PCA_data[0].mm[1], PCA_data[2].mm[1]])[1]]  
        mmy = [minmax([PCA_data[0].mm[0], PCA_data[2].mm[0]])[0], 
                minmax([PCA_data[0].mm[1], PCA_data[2].mm[1]])[1]]  
        cmlx = d3.scale.linear().domain(mmx).range([0,P3.CmapLegSize-1]);
        cmly = d3.scale.linear().domain(mmy).range([0,P3.CmapLegSize-1]);
        sel = function(d) {return [+d.PCA_0,+d.PCA_2]};
        break;
    case "PC12":
        mmx = [minmax([PCA_data[2].mm[0], PCA_data[1].mm[0]])[0], 
                minmax([PCA_data[2].mm[1], PCA_data[1].mm[1]])[1]]  
        mmy = [minmax([PCA_data[2].mm[0], PCA_data[1].mm[0]])[0], 
                minmax([PCA_data[2].mm[1], PCA_data[1].mm[1]])[1]]  
        cmlx = d3.scale.linear().domain(mmx).range([0,P3.CmapLegSize-1]);
        cmly = d3.scale.linear().domain(mmy).range([0,P3.CmapLegSize-1]);
        sel = function(d) {return [+d.PCA_1,+d.PCA_2]};
        break;
    }

    /* 1) reapply colorDatum to the "fill" of the states in #mapUS.
       be sure to add a transition that lasts TransitionDuration */
    d3.select("#mapUS").selectAll("path")
        .data(P3.data) 
        .transition()
              .duration(TransitionDuration)
              .style("fill", function(d){ return colormap(sel(d)); });

    /* 2) reset pixels of cmlImage.data, and redisplay it with
       P3.cmlContext.putImageData(P3.cmlImage, 0, 0); */
    if (CmapUnivariate) {
        for (var j=0, k=0, c; j < P3.CmapLegSize; ++j) {
            for (var i=0; i < P3.CmapLegSize; ++i) {
                if (0 == j) {
                    c = d3.rgb(colormap(cml.invert(i)));
                    P3.cmlImage.data[k++] = c.r;
                    P3.cmlImage.data[k++] = c.g;
                    P3.cmlImage.data[k++] = c.b;
                    P3.cmlImage.data[k++] = 255;
                } else {
                    P3.cmlImage.data[k] = P3.cmlImage.data[(k++)-4*P3.CmapLegSize];
                    P3.cmlImage.data[k] = P3.cmlImage.data[(k++)-4*P3.CmapLegSize];
                    P3.cmlImage.data[k] = P3.cmlImage.data[(k++)-4*P3.CmapLegSize];
                    P3.cmlImage.data[k] = 255; k++;
                }
            }
        }
    } else {
        for (var j=0, k=0, c; j < P3.CmapLegSize; ++j) {
            for (var i=0; i < P3.CmapLegSize; ++i) {
                c = d3.rgb(colormap([cmlx.invert(i),
                                     cmly.invert(P3.CmapLegSize-1-j)]));
                P3.cmlImage.data[k++] = c.r;
                P3.cmlImage.data[k++] = c.g;
                P3.cmlImage.data[k++] = c.b;
                P3.cmlImage.data[k++] = 255;
            }
        }
    }
    P3.cmlContext.putImageData(P3.cmlImage, 0, 0);

    /* 3) set d3.select("#xminlabel").html(), and similarly for the other
       three labels, to reflect the range of values that are
       colormapped when displaying "wat".  For univariate maps,
       set xminlabel and yminlabel to show the range, and set
       yminlabel and ymaxlabel to an empty string.  For bivariate
       maps, set all labels to show the X and Y ranges. */
    d3.select("#xminlabel").html("<text>" + mmx[0] + "</text>");
    d3.select("#xmaxlabel").html("<text>" + mmx[1] + "</text>");
    if (CmapUnivariate) {
        d3.select("#yminlabel").html("<text></text>");
        d3.select("#ymaxlabel").html("<text></text>");
    } else {
        d3.select("#yminlabel").html("<text>" + mmy[0] + "</text>");
        d3.select("#ymaxlabel").html("<text>" + mmy[1] + "</text>");
    }

    /* 4) update the geometric attributes (rx, ry, cx, cy) of the #cmlMarks
       to indicate the data variables, and any other attributes you want
       to control according to whether the state is selected. Changes should
       happen with a transition of duration TransitionDuration.
       (your code here) (or interspersed below) */


    if (CmapUnivariate) {
        d3.select("#cmlMarks").selectAll("ellipse")
            .data(P3.data)
            .transition()
              .duration(TransitionDuration)
            .attr("rx", 0.05) // if zero, outline may disappear
            .attr("ry", P3.CmapLegSize/4)
            .attr("cx", function(d) { console.log(sel(d)); return 0.5+cml(sel(d)); })
            .attr("cy", P3.CmapLegSize/2);
    } else {
        d3.select("#cmlMarks").selectAll("ellipse")
            .data(P3.data)
            .transition()
              .duration(TransitionDuration)
            .attr("rx", MarkRadius).attr("ry", MarkRadius)
            .attr("cx", function(d) { return 0.5+cmlx(sel(d)[0]); })
            .attr("cy", function(d) { return P3.CmapLegSize-0.5-cmly(sel(d)[1]); });
    }



}

/* shouldn't have to change anything from here on */
return { // the P3 "API"
    HexScaling: HexScaling,
    choiceSet: choiceSet,
    dataFinish: dataFinish,
    toggleState: toggleState,
};

})(); // end "var P3=(function () {" module container

/* Answer questions here. Each should be no more than ~40 words.

#1) Concisely describe and justify your method of indicating, in the map
and in the colormap, whether a state is selected.

To indicate whether a state is selected, we chose to put a solid white line 
around it and then flip the colors of the state label (white text with black 
shadow) and make it bigger and bolder so that the color of the state is not obscurred but 
it is also clear which state is selected, especially if the six states around 
a particular state are selected but the state in the middle is not.

#2) In the terminology of "An Algebraic Process for Visualization
Design" (class May 26), what is one "confuser" for PCA as it it used
in this project (i.e. a particular change in the data that will have
no significant effect on the PCA result)?  (hint: think about what
dataNarm() does, and how the covariance matrix is computed).  There
are at least three possible answers.


A change in the data which would have no change on the PCA result is a 
data set in which all values are larger/smaller/more extreme, but are still
distributed the same and vary the same. In this case, normalizing the 
data will create the same spread, though the data values themselves 
will be different. In a way, this is reminiscent of the explanation about how
"changing flow magnitude while preserving
direction is a confuser since the computed streamlines will be the
same" (Kindlmann 5). In our case, changing the data values in a scalar way
is a confuser because we ultimately will always have a variance of 1. So
any data that can be normalized the "same way" will appear to be the same.
In many ways, this could be intentional, since all we care about IS variance;
for example, Kindlmann notes "Though generally unwelcome,
confusers can be ignored in certain application areas" (Kindlmann 5). 
In this case, it's not a huge deal to ignore the confuser because we 
only care about basic variance.

#3) Concisely describe and justify your design of colormaps for the
univariate and bivarite cases of PCA visualization.

UNIVARIATE:
For univariate, we chose the complementary (ish) colors green and pink,
because we wanted to demonstrate ratio quantities. They are not exactly
complementary, but they appear to have the same luminance and so can easily be
compared, which represented the data better than directly complementary colors.
These still hold in negation, however.
The zero values are represented by gray, because we note in Lecture 04/05,
Coloring values with meaningful zero should be anti-symmetric
under negation (reflection). Our colors hold and gray allows us to have a true 0.

BIVARIATE:
For bivariate we again chose the complementary (ish) colors blue and orange/yellow, 
along with changes in luminance along the diagonal values, because we wanted to 
demonstrate ratio quantities. This display allows us to easily find the zero and 
understand in which direction the values are increasing or decreasing. 

#4) Based on exploring the data with PCA, what was a result that you found
from PCA of three or four variables?  Describe your result in terms of
which variables had similar vs complementary contributions to the PCA,
or the geographic trend you saw in the map.

Men and women's earnings often had complementary contributions to PCA,
however, men's earnings were always higher than women's earnings, which
isn't surprising at all. We can see some interesting results 
if we click on ME, WE, and PL (political leaning). Here we see that
states like Wyoming, Utah, and DC are outliers. DC is white while 
Wyoming and Utah are dark. Based on the map, we can see the DC seems
to have a higher than ~average~ women's earnings
COMPARED to men's earnings, and also tends to lean MUCH more to the left on the
political spectrum. Interestingly, a state like South Dakota also has
relatively high women's compared to men's earnings, though it is 
very far right on the political spectrum!

Wyoming and Utah are dark and are far right on the political spectrum as well,
but there are many states that would seem to be liberal but have lower 
relative women's earnings. 

What does this tell us? While men's and women's earnings are complementary,
there are some interesting and perhaps unexpected results relating to
political leaning. Some conservative places, like South Dakota, have higher than
usual relative women's earnings, while some places like Conneticut seem to 
be liberal but have lower than usual relative women's earnings.

(extra credit) #5) How did you maximize visual consistency when switching
between PCA and other radio buttons?

Well, we tried to maximize visual consistency by choosing a color scheme
for univariate PCA that was different from all the usual radio buttons and was
also different from the PCA with bivariate components. This reduces the 
hallucinators AND misleaders, because it makes it apparent that the types
(univ PCA vs bivar PCA vs other maps) should be distingished, 
but that PCA univariate and PCA bivariate are consistent within their
sub-options (all PCA univ are purple/green). 
We also tried to maximize visual consistency by choosing colors
that didn't look like any of the "normal" colormaps, so it would be 
clear that PCA was a different process.

One hallucinator that we didn't fix because it was required is the flipping
around of the circles and lines while clicking on options - this seems to imply
continuity or at least movement, when there isn't necessarily any.


*/
