var reader = new FileReader();

var video       = null;
var fileName    = null;
var fileInput   = null
var ta          = null;
var start       = null;
var end         = null;
var frameNo     = null;
var pauseOnJump = false;
var lines       = [];
var inFrame     = false;
var lI          = 0;
var frameHold   = false;
var lastTm      = 86399999;
var rollBack    = 400;

function LG() { console.log(JSON.stringify(arguments)); }

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
        var file= fileInput.files[0];
        fileName = file.name;
        document.getElementById('saveFileName').value = fileName.substr(0,fileName.length-4);
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(e) { Parse(reader.result); };
        $('#fileOver').addClass('chosen');
    });
});

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
    if (frameHold) return false;

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
    if (!frameHold) {
        if (!ctInFrame(currentTm)) {
            if (lines[lI][0] > currentTm) 
                while (lI >= 0 && lines[lI][0] > currentTm) lI--;

            if (lI<0) lI = 0; 

            if (lines[lI][1] < currentTm)
                while (lI < lines.length && lines[lI][0] < currentTm) lI++;

            if (lI >= 0 && lI >= lines.length-1)
                appendFrame();
        } 

        setFrame();
        setOverlaps();
    }
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
        
   $('#activeCaption').text(inFrame ? lines[lI][2] : "");

   updateSlider();
}

function appendFrame() {
    console.log('APPEND', lI, lines[lI-1][0]);
    if (lines[lI-1][0] > 0) {
        lines.push([0, lastTm, '', '']);
        lI = lines.length-1;
        $('.timers').attr('class', 'timers isNew');
    } else {
        lI--;
    }
    return false;
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
    if (pauseOnJump) video.pause();
}

function syncCT(arg) {
    if (typeof arg != 'undefined' && arg) {
        console.log('setting start', toMs(start.value));
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
        start.value = fromMs(getCT()*1000 - rollBack);
    }
    updateFrame(true);
    setOverlaps();
}

function Parse(cont) {
    lines = [];
    if (typeof cont != 'undefined' && cont.trim() != '') {
        var byLine = cont.split('\n\n');
        var line = '';
        var idx  = -1;
        var isNote = false;
        for (var i=0; i<byLine.length; i++) {
            line = byLine[i].trim();
            if (line.trim() != '') {

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
                        lines[++idx] = [0, lastTm, line, ''];
                    }

                }
            }
        }
    } else {
        lines = [[0, lastTm, 'New Project - first frame', '']];
        $('#fileOver').removeClass('chosen');
    }
    lI = 0;
    LG( lines);
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

function updateFrame(withRoll) {
    if (lines.length == 0) Parse('');
    lines[lI][0] = toMs(start.value);
    lines[lI][1] = toMs(end.value);
    lines[lI][2] = ta.value;
}

function updateSlider() {
    var back    = lI > 0 ? lI - 1 : 0;
    var forth   = lI < lines.length -1 ? lI + 1 : lI;
    $('#frameSlide >*').remove();
    var els = [];
    var allEls = 0;
    for (var i = back; i <= forth; i++) {
        if (lines[i][1] == lastTm)
            els.push(-1);
        else 
            allEls += els[els.push(lines[i][1] - lines[i][0])-1];

        if (i != forth )
            if (lines[i+1][1] == lastTm)
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
                + ' background:' + (odd ? "#bfc" : "green") + '"'
                + (i==back  ? " onclick='frameChange(-1)'" : '')
                + (i==forth ? " onclick='frameChange(1)'" : '')
                + '>' + idx + '</div>');
        var inn = null;
        if (i < forth) {
            $('#frameSlide').append( $('<div class="spacer"></div>')
                .css({"width" :  Math.floor((100 * els.shift())/allEls).toString() + "%"})
            );

            console.log($(inn));

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

function save(){
    var outVtt = "WEBVTT\n\n";
    var outSrt = "";
    for (var i=0; i<lines.length; i++)
    {
        if (lines[i][0] != 0 && lines[i][1] != 0) {
            outVtt += getLine(i, true);
            outSrt += getLine(i, false);
        }
    }
    var fileName = document.getElementById('saveFileName').value;
    download(fileName, "vtt", outVtt);
    download(fileName, "srt", outSrt);
}

function download(filename, fType, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/' + fType + ';charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename + '.' +  fType);
    pom.click();
}

function toggleJumpPause() {
    var el =  $("#togglePause span");
        
    pauseOnJump = el.text().substring(0,1) == 'P';
    el.text((pauseOnJump ? "Cont" : "Pause") + " On Jump");
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

function loadFromParams() {
        $('#video-active').find('source').attr('src', $('#vidName').val());
        $('#video-active').find('track').attr('src',  $('#vttName').val());
        video.load();
        if (lines.length == 0) Parse('');
        $('#workArea').show();
}

function infEnd() {
    lines[lI][1] = lastTm;
    setFrame();
}

function setRollBack() {
    rollBack = $('#rollBack').val();
}
