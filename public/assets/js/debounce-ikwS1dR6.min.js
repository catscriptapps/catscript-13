function i(t,o){let e;return function(...u){const n=()=>{clearTimeout(e),t(...u)};clearTimeout(e),e=setTimeout(n,o)}}export{i as d};
