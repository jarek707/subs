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
    playOnSync  : true,
    liveUpdate  : true,
    volume      : 0.8,

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
        $('#rollBackVal').text("Roll Back:" + Config.rollBack);
        $('#volume').val(Config.volume);

        $('#autoLoad').attr('checked', Config.autoLoad);
        $('#autoPlay').attr('checked', Config.autoPlay);
        $('#liveUpdate').attr('checked', Config.liveUpdate);

        if (Config.autoLoad) {
            loadFromParams();
            if (Config.autoPlay) togglePlay();
        }
        video.volume = Config.volume;
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
        if ($('#baseName').val() == '')
            $('#baseName').val(Config.baseName);
    }

    $('#rollBackVal').text("Roll Back:" + Config.rollBack);

    Config.lI = lI;
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
        lines.push([getCT()*1000, Config.lastTm, '', 'position:10%']);
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

function setFrame(newLI) {
    if (typeof newLI != 'undefined') lI = newLI;

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
    if (Config.liveUpdate || video.paused) {
        if (lI > 0) {
            $('#prevEnd').text(fromMs(Math.abs(lines[lI][0] - lines[lI-1][1])).substr(6)).css({"opacity" : 1});
            
            if (lines[lI][0]<lines[lI-1][1])    $('#prevEnd').addClass("overlap");
            else                                $('#prevEnd').removeClass("overlap");
        } else {
            $('#prevEnd').text(fromMs(lines[lI][0].toString()).substr(6));
        }

        if (lI < lines.length-1) {
            $('#nextStart').text(fromMs(Math.abs(lines[lI+1][0] - lines[lI][1])).substr(6)).css({"opacity" : 1});;

            if (lines[lI][1]>lines[lI+1][0])    $('#nextStart').addClass("overlap");
            else                                $('#nextStart').removeClass("overlap");
        } else {
            $('#nextStart').text('END');
        }
    } else {
            $('#prevEnd').css({"opacity" : 0});
            $('#nextStart').css({"opacity" : 0});
    }
}

function jump(jumpInt, which) {
    if (typeof which == 'undefined') which=-0;

    switch (which) {
        case -3: lines[lI][0] = 0; break;
        case -2: lines[lI][1] = Config.lastTm; break;
        case  0: video.currentTime -= jumpInt; break;
        case  1: lines[lI][0] -= 1000 * jumpInt; break;
        case  2: 
            lines[lI][0] -= 1000 * jumpInt;
            lines[lI][1] -= 1000 * jumpInt; 
            break;
        case  3: lines[lI][1] -= 1000 * jumpInt; break;
    }
    if (which>0) video.currentTime = lines[lI][0]/1000;
    setFrame();
    setOverlaps();
}

function setAutoPlay(el) {
    $(el).text('Auto Play ' + (Config.playOnSync ? 'Off' : 'On'));
    Config.playOnSync = !Config.playOnSync;
}

function flashBg(targetEl, cond) {
    $(targetEl).css({"background" : (cond ? "#afd" : "#faa")});
    setTimeout( 
        function() { $(targetEl).css({"background" : "transparent"}); }
   , 300);
}

function syncCT(arg) {
    var isStart     = typeof arg != 'undefined' && arg;

    setCT(toMs(isStart ? start.value : end.value)/1000, 0);

    if (Config.playOnSync) {
        flashBg(isStart ? '#toStart' : '#toEnd', video.paused);
        togglePlay();
    }
}

function syncTm(which) {
    var curEl = document.getElementById("current");
    if (typeof which == 'undefined') {
        end.value = curEl.innerText;
    } else {
        start.value = fromMs(getCT()*1000 - Config.rollBack);
        setCT(start.value/1000,0);
    }
    updateFrame();
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
        if (confirm( "This will create a new subtitles file and overwrite existing work if any.\nPlease confirm/cancel."
                   )) {

            lines = [[0, Config.lastTm, 'New Project - first frame', '']];
            $('#fileOver').removeClass('chosen');
            lI = 0;
        }
    }
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
    if (Config.liveUpdate || video.paused) {
        $('#frameSlide >*').remove();
        if (lines.length < 1 || lines[lI][1] == Config.lastTm) return;

        var back    = lI > 0 ? lI - 1 : 0;
        var forth   = lI < lines.length - 1 ? lI + 1 : lI;
        if (lines[forth][1] == Config.lastTm) // Ignore infinite length frames
            forth--;

        var elCount = 1+(forth-back)*2;
        var stretch = lines[forth][1] - lines[back][0];

        var els = [];
        var coords = [];
        for (var i = back; i <= forth; i++) {
            els[els.push(lines[i][1] - lines[i][0])-1];
            coords.push({"t" : i.toString()});

            if (i != forth ) {
                els[els.push(lines[i+1][0] - lines[i][1])-1];
                coords.push({"t" : ''});
            }
        }

        var sum = 0;
        for (var i=0; i<elCount; i++) {
            //coords[i].v = Math.round(100*els[i]/stretch);
            coords[i].v = 100*els[i]/stretch;
            sum += coords[i].v;
            if (coords[i].v < 0.4 && coords[i].v>0) {
                var subtr = coords[i].v;
                coords[i].v = 0.25;
                coords[i-1].v -= 0.25 - subtr;
            }
        }
         
        if (sum != 100) coords[i-1].v -= sum - 100;

        for (var i=1; i < elCount; i += 2) {
            if (coords[i].v < 0) {
                coords[i].v = -coords[i].v;
                coords[i+1].v = coords[i+1].v - 2*coords[i].v;
                coords[i].t = 'overlap';
                if (coords[i+1].v < 0) {
                    coords[i].v += coords[i+1].v - 5;
                    coords[i+1].v=5;
                    coords[i].t = 'overlap cover';
                }
            }
        }

        for (var i=0; i<elCount; i++){
            var domClass = (i>0 && i<elCount-1) ? "inner" : "outer";
            if (coords[i].t == '' || coords[i].t == 'overlap') {
                $('#frameSlide').append( $('<div class="spacer ' + coords[i].t + '"></div>')
                    .css({"width" :  coords[i].v.toString() + "%"})
                );
            }else if (coords[i].t == 'overlap cover') {
                $('#frameSlide').append( $('<div class="spacer ' + coords[i].t + '"></div>')
                    .css({"width" :  coords[i].v.toString() + "%"})
                );
            } else {
                $('#frameSlide').append('<div class="' + domClass + '"'
                    + ' style="width:' + coords[i].v + '%;"'
                    + (i==0 ? " onclick='frameChange(-1)'" : '')
                    + (i==(elCount-1) ? " onclick='frameChange(1)'" : '')
                    + '>' + coords[i].t + '</div>');
            }
        }
        $('#frameSlide').css({"opacity":1});
    } else {
        $('#frameSlide').css({"opacity":0.2});
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
        if (lines[i][0] != 0 && lines[i][1] != 0 && lines[i][2] != '') {
            outVtt += getLine(i, true);
            outSrt += getLine(i, false);
        }
    }

    if (typeof localOnly != 'undefined' && localOnly) {
        localStorage.setItem("subTool:" + Config.baseName + '.vtt', outVtt);
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

function goToFrame() {
    if ($('#frameSel button').length == 0)
        for (var i=0; i< lines.length; i++) {
            $('#frameSel').append(
                    '<button onclick="setFrame(' + i + '); syncCT(true); $(\'#frameSel\').slideUp();">' + i.toString() + '</button>'
                    );
        }
    $('#frameSel:visible').slideUp();
    $('#frameSel:hidden').slideDown();
}
