// Globall DOM Els
var video       = null;
var fileInput   = null
var ta          = null;
var start       = null;
var end         = null;
var frameNo     = null;

var lines       = [];
var inFrame     = false;
var lI          = 0;

// Local Storage Test TODO
var locStor     = {};
var lsS         = "";

var Config = {
    frameNo     : null,
    lines       : [],
    lI          : 0,
    rollBack    : 000,
    lastTm      : 86399999,
    baseName    : 'bench',
    vidName     : 'bench.mp4',
    autoLoad    : true,
    autoPlay    : true,

    minFrameLength : 600
}

function LG() { console.log(JSON.stringify(arguments)); }

for ( var i in localStorage) {
    if (i.substr(0, 7) == 'subTool') {
        locStor[i.substr(8)] = localStorage.getItem(i);
        lsS += "<option value='" + i.substr(8) + "'>" + i.substr(8) + '</option>';
    }
}

console.log(localStorage);
console.log( locStor );

$(document).ready(function(){
    video       = document.getElementById('video-active');
    fileInput   = document.getElementById('fileInput');
    ta          = document.getElementById('caption');
    start       = document.getElementById('start');
    end         = document.getElementById('end');
    frameNo     = document.getElementById('frameNo');

    $("#video-active").on( "timeupdate", function(event){ 
        onTrackedVideoFrame(this.currentTime); 
    });
    
    fileInput.addEventListener('change', function(e) {
        var file = fileInput.files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(e) { Parse(reader.result); };
        $('#fileOver').addClass('chosen');
    });

    Init();
});

function Init() {
    var config = localStorage.getItem("subTool:Config");

    if (config != null) {
        Config = $.extend(Config, JSON.parse(config));

        $('#vidName').val(Config.vidName);
        $('#baseName').val(Config.baseName);
        $('#rollBack').val(Config.rollBack);

        $('#autoLoad').attr('checked', Config.autoLoad);
        $('#autoPlay').attr('checked', Config.autoPlay);

        if (Config.autoLoad) {
            loadFromParams();
            if (Config.autoPlay) video.play();
        }
    }
}

function loadFromParams() {
        $(video).find('source').attr('src', Config.vidName);
        //$(video).find('track').attr('src', Config.baseName + '.vtt');
        Parse(localStorage.getItem("subTool:" + Config.baseName + '.vtt'));
        //if (lines.length == 0) Parse(localStorage.getItem('bench.vtt'));
        video.load();
        $('#workArea').show();
}

function saveConfig(key, value) {
    if (typeof value == 'object')
        switch ($(value).attr('type')) {
            case "text" : value = value.value; break;
            case "checkbox" : value = $(value).is(":checked");
            default : ;
        }
    
    Config[key] = value;
    if (key == 'vidName') {
        Config.baseName = value.substr(0, value.length-4);
        $('#baseName').val(Config.baseName);
    }


    localStorage.setItem('subTool:Config', JSON.stringify(Config));
}

function onTrackedVideoFrame(currentTime){
    if (typeof lines != 'undefined' && typeof lines[0] != 'undefined') {
        findFrame(currentTime*1000);
        $("#current").text(fromMs(currentTime*1000));
    }
}

function getCT()                { return video.currentTime; }
function getCTInt()             { return video.currentTime * 1000; }
function setCT(stamp, offset)   { if (stamp > 0) video.currentTime = stamp + offset; } 
function ctInFrame(ct)          { return inFrame = lI>=0 && lines[lI][0]<=ct && lines[lI][1]>=ct; }

function frameChange(arg) {
    switch (typeof arg) {
        case 'number'   : lI += parseInt(arg); break;
        case 'boolean'  : lI = arg ? 0 : lines.length - 1; break;
        default         : lI = parseInt(arg.value);
    }

    if (lI < 0)             lI = 0;
    if (lI >= lines.length) lI = lines.length - 1;
    if (lines[lI][0] >= 0)   setCT(lines[lI][0]/1000, 0.001);
    setFrame();

}

function findFrame(currentTm) {
        if (!ctInFrame(currentTm)) {
            if (lines[lI][1] < currentTm)
                while (lI < lines.length && lines[lI][1] < currentTm) lI++;
            if (lines.length<=lI) {
                appendFrame();
            } else {
                if (lI>0 && lines[lI-1][0] > currentTm)
                    while (lI >= 0 && lines[lI][0] > currentTm) lI--;

                if (lI<0) lI = 0; 
            }
        } 

        setFrame();
        setOverlaps();
}

function appendFrame() {
    if (lines[lI-1][0] > 0) {
        lines.push([getCT()*1000, Config.lastTm, 'frame ' + lI.toString() , '']);
        lI = lines.length-1;
        $('.timers').attr('class', 'timers isNew');
    } else {
        lI--;
    }
    return false;
}

function updateFrame() {
    if (lines.length == 0) Parse(''); // Safety, lines should have at least one element by now

    var startTm = toMs(start.value);
    var endTm   = toMs(end.value);

    if (endTm - startTm < Config.minFrameLength) // Enforce min frame length
        endTm = startTm + Config.minFrameLength;

    lines[lI][0] = startTm;
    lines[lI][1] = endTm;
    lines[lI][2] = ta.value;
    lines[lI][3] = $('#timeArgs').val();
}

function setFrame() {
    ta.value        = lines[lI][2];
    start.value     = fromMs(lines[lI][0]);
    end.value       = fromMs(lines[lI][1]);
    frameNo.value   = lI;
    $('#timeArgs').val(lines[lI][3]);

    var timerClass = 'timers';
    if (inFrame) 
        if (lI == lines.length-1)   timerClass += " isNew";
        else                        timerClass += " isIn"

    $('.timers').attr('class', timerClass);
        
   $('#activeCaption').html(inFrame ? lines[lI][2] : "");

   updateSlider();
}

function setOverlaps() {
    if (lI > 0) {
        $('#prevEnd').text(fromMs(Math.abs(lines[lI][0] - lines[lI-1][1])).substr(6));
        
        if (lines[lI][0]<lines[lI-1][1])    $('#prevEnd').addClass("overlap");
        else                                $('#prevEnd').removeClass("overlap");
    }

    if (lI < lines.length-1) {
        $('#nextStart').text(fromMs(Math.abs(lines[lI+1][0] - lines[lI][1])).substr(6));

        if (lines[lI][1]>lines[lI+1][0])    $('#nextStart').addClass("overlap");
        else                                $('#nextStart').removeClass("overlap");
    }
}

function jump(jumpInt) {
    video.currentTime -= jumpInt;
}

function syncCT(arg) {
    if (typeof arg != 'undefined' && arg) {
        setCT(toMs(start.value)/1000, 0.001);
    } else {
        setCT(toMs(end.value)/1000, -0.001);
    }
}

function syncTm(which) {
    var curEl = document.getElementById("current");
    if (typeof which == 'undefined') {
        end.value = curEl.innerText;
    } else {
        start.value = fromMs(getCT()*1000 - Config.rollBack);
    }
    updateFrame(true);
    setOverlaps();
}

function Parse(cont) {
    lines = [];
    if (typeof cont != 'undefined' && cont != null && cont.trim() != '') {
        var byLine = cont.split('\n\n');
        var line = '';
        var idx  = -1;
        var isNote = false;
        for (var i=0; i<byLine.length; i++) {
            line = byLine[i].trim();
            if (line.trim() != '' && line.trim() != 'WEBVTT' ) {
                var parts = line.match(/(^.*\d\d:\d\d[,.]\d\d\d.*-->.*\d\d:\d\d[,.]\d\d\d)(.*\r?\n)((.|\r?\n)*)/);
                if ( parts ) {
                    var times = parts[1].split('-->');
                    lines[++idx] = [toMs(times[0]), toMs(times[1]), parts[3], parts[2].trim()];
                    isNote = false;
                } else {
                    if (line.indexOf('NOTE') > -1) {
                        isNote = true;
                        lines[++idx] = [-1, -1, line, ''];
                    } else {
                        lines[++idx] = [0, Config.lastTm, line, ''];
                    }

                }
            }
        }
    } else {
        lines = [[0, Config.lastTm, 'New Project - first frame', '']];
        $('#fileOver').removeClass('chosen');
    }
    lI = 0;
    setFrame();

    if (false)
        for (var i=0;i <lines.length; i++)  {
            console.log( i );
            console.log(lines[i]);
           }

}

function toMs(inS) {
    if (inS == 0) return 0;
    inS = inS.toString();
    var sA = inS.indexOf(',') > -1 ? inS.split(',') : inS.split('.');
    var mils = parseInt(sA.pop());
    var tA = sA[0].split(':');
    var secs = parseInt(tA.pop()) * 1000;
    var mins = parseInt(tA.pop()) * 60000;
    var hurs = parseInt(tA.pop()) * 3600000;

    return hurs + mins + secs + mils;
}

function fromMs(stamp, isVtt) {
    isVtt = (typeof isVtt == 'undefined') ? false : isVtt;

    var hurs = Math.floor(stamp/3600000).toString();
    var rest = stamp-hurs*3600000;
    var mins = Math.floor(rest/60000).toString();
    rest = rest - mins*60000;
    var secs = Math.floor(rest/1000).toString();
    var mils = Math.floor(rest - secs*1000).toString();

    if (hurs.length == 1) hurs = '0' + hurs;
    if (mins.length == 1) mins = '0' + mins;
    if (secs.length == 1) secs = '0' + secs;

    if (mils.length == 1) mils = '00' + mils;
    if (mils.length == 2) mils = '0'  + mils;

    return isVtt    ? hurs + ":" + mins + ":" + secs + "." + mils
                    : hurs + ":" + mins + ":" + secs + "," + mils;
}

function updateSlider() {
    var back    = lI > 0 ? lI - 1 : 0;
    var forth   = lI < lines.length -1 ? lI + 1 : lI;
    $('#frameSlide >*').remove();
    var els = [];
    var allEls = 0;
    for (var i = back; i <= forth; i++) {
        if (lines[i][1] == Config.lastTm)
            els.push(-1);
        else 
            allEls += els[els.push(lines[i][1] - lines[i][0])-1];

        if (i != forth )
            if (lines[i+1][1] == Config.lastTm)
                allEls += els[els.push(300)-1];
            else
                allEls += els[els.push(lines[i+1][0] - lines[i][1])-1];
    }

    var odd = true;
    var idx = '';
    for (var i = back; i <= forth; i++) {
        var popped = els.shift();
        if (popped == -1) {
            allEls += 2000;
            popped = 2000;
            idx = '&#8734';
        } else {
            idx=i.toString();
        }

        var perc = Math.floor((100*popped)/allEls)/2;

        $('#frameSlide').append('<div '
                + ' style="width:' + perc + '%;'
                + ' background:' + (odd ? "#bfc" : "#9da") + '"'
                + (i==back  ? " onclick='frameChange(-1)'" : '')
                + (i==forth ? " onclick='frameChange(1)'" : '')
                + '>' + idx + '</div>');
        var inn = null;
        if (i < forth) {
            $('#frameSlide').append( $('<div class="spacer"></div>')
                .css({"width" :  Math.floor((100 * els.shift())/allEls).toString() + "%"})
            );
        }
        odd = !odd;
    }
}

function getLine(i, isVtt) {
    var out =  
        fromMs(lines[i][0], isVtt) + " --> " 
        + fromMs(lines[i][1], isVtt) + "\n" + lines[i][2] + "\n\n";
    return out;
}

function save(localOnly){
    var outVtt = "WEBVTT\n\n";
    var outSrt = "";
    for (var i=0; i<lines.length; i++)
    {
        if (lines[i][0] != 0 && lines[i][1] != 0) {
            outVtt += getLine(i, true);
            outSrt += getLine(i, false);
        }
    }

    if (typeof localOnly != 'undefined' && localOnly) {
        localStorage.setItem("subTool:" + Config.baseName + '.vtt', outVtt);
        LG( localStorage);
    } else {
        download(Config.baseName, "vtt", outVtt);
        download(Config.baseName, "srt", outSrt);
    }
}

function download(filename, fType, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/' + fType + ';charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename + '.' +  fType);
    pom.click();
}

function togglePlay() {
    if (video.paused) {
        video.play();
        $("#bigPlayButton").text("Pause");
    } else {
        video.pause();
        $("#bigPlayButton").text("Play");
    }
}

function infEnd() {
    lines[lI][1] = Config.lastTm;
    setFrame();
}
