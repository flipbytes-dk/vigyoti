import{r as c,j as e,dx as v,l as n,Q as F,R as w,D as E,bc as L,dy as R,dz as S,dA as r,dB as k,dC as A,t as C,dD as I}from"./vendor-Cb3zlNNd.js";import{p as _,d as j,$ as D,D as O,t as T,a4 as z}from"./vendor-arizeai-Buo4e1A6.js";import{E as $,L as N,R as G,r as B,b as U,F as M,A as J,c as K,d as W,P as q,h as H,M as Q,e as m,D as V,f as Y,g as X,i as Z,j as ee,k as re,l as ae,p as te,n as u,o as oe,S as ne,s as se,q as le,t as h,v as ie,w as g,x as f,y as de,z as ce,B as pe,C as me,G as ue,H as b,I as he,J as ge,K as fe,N as be,O as xe,Q as ye,U as Pe}from"./pages-CVY3Nv4Z.js";import{c7 as ve,a5 as Fe,U as we,c8 as Ee,c9 as Le}from"./components-DKH6AzJw.js";import"./vendor-three-DwGkEfCM.js";import"./vendor-recharts-Cl9dK5tC.js";import"./vendor-codemirror-BuAQiUVf.js";import"./vendor-shiki-CazYUixL.js";(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))d(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&d(l)}).observe(document,{childList:!0,subtree:!0});function i(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function d(t){if(t.ep)return;t.ep=!0;const o=i(t);fetch(t.href,o)}})();const x="arize-phoenix-feature-flags",p={__RESET__:!1};function Re(){const a=localStorage.getItem(x);if(!a)return p;try{const s=JSON.parse(a);return Object.assign({},p,s)}catch{return p}}const y=c.createContext(null);function Se(){const a=w.useContext(y);if(a===null)throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");return a}function ke(a){const[s,i]=c.useState(Re()),d=t=>{localStorage.setItem(x,JSON.stringify(t)),i(t)};return e(y.Provider,{value:{featureFlags:s,setFeatureFlags:d},children:e(Ae,{children:a.children})})}function Ae(a){const{children:s}=a,{featureFlags:i,setFeatureFlags:d}=Se(),[t,o]=c.useState(!1);return v("ctrl+shift+f",()=>o(!0)),n(F,{children:[s,e(O,{type:"modal",isDismissable:!0,onDismiss:()=>o(!1),children:t&&e(_,{title:"Feature Flags",children:e(j,{height:"size-1000",padding:"size-100",children:Object.keys(i).map(l=>e(D,{isSelected:i[l],onChange:P=>d({...i,[l]:P}),children:l},l))})})})]})}function Ce(){return e(L,{styles:a=>E`
        body {
          background-color: var(--ac-global-color-grey-75);
          color: var(--ac-global-text-color-900);
          font-family: "Roboto";
          font-size: ${a.typography.sizes.medium.fontSize}px;
          margin: 0;
          overflow: hidden;
          #root,
          #root > div[data-overlay-container="true"],
          #root > div[data-overlay-container="true"] > .ac-theme {
            height: 100vh;
          }
        }

        /* Remove list styling */
        ul {
          display: block;
          list-style-type: none;
          margin-block-start: none;
          margin-block-end: 0;
          padding-inline-start: 0;
          margin-block-start: 0;
        }

        /* A reset style for buttons */
        .button--reset {
          background: none;
          border: none;
          padding: 0;
        }
        /* this css class is added to html via modernizr @see modernizr.js */
        .no-hiddenscroll {
          /* Works on Firefox */
          * {
            scrollbar-width: thin;
            scrollbar-color: var(--ac-global-color-grey-300)
              var(--ac-global-color-grey-400);
          }

          /* Works on Chrome, Edge, and Safari */
          *::-webkit-scrollbar {
            width: 14px;
          }

          *::-webkit-scrollbar-track {
            background: var(--ac-global-color-grey-100);
          }

          *::-webkit-scrollbar-thumb {
            background-color: var(--ac-global-color-grey-75);
            border-radius: 8px;
            border: 1px solid var(--ac-global-color-grey-300);
          }
        }

        :root {
          --px-blue-color: ${a.colors.arizeBlue};

          --px-section-background-color: ${a.colors.gray500};

          /** The color of shadows on menus etc. */
          --px-overlay-shadow-color: rgba(0, 0, 0, 0.4);

          /* An item is a typically something in a list */
          --px-item-background-color: ${a.colors.gray800};
          --px-item-border-color: ${a.colors.gray600};

          --px-font-weight-heavy: 600;

          --px-gradient-bar-height: 8px;

          --px-nav-collapsed-width: 45px;
          --px-nav-expanded-width: 200px;
        }

        .ac-theme--dark {
          --px-primary-color: #9efcfd;
          --px-primary-color--transparent: rgb(158, 252, 253, 0.2);
          --px-reference-color: #baa1f9;
          --px-reference-color--transparent: #baa1f982;
          --px-corpus-color: #92969c;
          --px-corpus-color--transparent: #92969c63;
        }
        .ac-theme--light {
          --px-primary-color: #00add0;
          --px-primary-color--transparent: rgba(0, 173, 208, 0.2);
          --px-reference-color: #4500d9;
          --px-reference-color--transparent: rgba(69, 0, 217, 0.2);
          --px-corpus-color: #92969c;
          --px-corpus-color--transparent: #92969c63;
        }
      `})}const Ie=R(S(n(r,{path:"/",errorElement:e($,{}),children:[e(r,{path:"/login",element:e(N,{})}),e(r,{path:"/reset-password",element:e(G,{}),loader:B}),e(r,{path:"/reset-password-with-token",element:e(U,{})}),e(r,{path:"/forgot-password",element:e(M,{})}),e(r,{element:e(J,{}),loader:K,children:n(r,{element:e(W,{}),children:[e(r,{path:"/profile",handle:{crumb:()=>"profile"},element:e(q,{})}),e(r,{index:!0,loader:H}),n(r,{path:"/model",handle:{crumb:()=>"model"},element:e(Q,{}),children:[e(r,{index:!0,element:e(m,{})}),e(r,{element:e(m,{}),children:e(r,{path:"dimensions",children:e(r,{path:":dimensionId",element:e(V,{}),loader:Y})})}),e(r,{path:"embeddings",children:e(r,{path:":embeddingDimensionId",element:e(X,{}),loader:Z,handle:{crumb:a=>a.embedding.name}})})]}),n(r,{path:"/projects",handle:{crumb:()=>"projects"},element:e(ee,{}),children:[e(r,{index:!0,element:e(re,{})}),n(r,{path:":projectId",element:e(ae,{}),loader:te,handle:{crumb:a=>a.project.name},children:[e(r,{index:!0,element:e(u,{})}),n(r,{element:e(u,{}),children:[e(r,{path:"traces/:traceId",element:e(oe,{})}),e(r,{path:"sessions/:sessionId",element:e(ne,{}),loader:se})]})]})]}),n(r,{path:"/datasets",handle:{crumb:()=>"datasets"},children:[e(r,{index:!0,element:e(le,{})}),n(r,{path:":datasetId",loader:h,handle:{crumb:a=>a.dataset.name},children:[n(r,{element:e(ie,{}),loader:h,children:[e(r,{index:!0,element:e(g,{}),loader:f}),e(r,{path:"experiments",element:e(g,{}),loader:f}),e(r,{path:"examples",element:e(de,{}),loader:ce,children:e(r,{path:":exampleId",element:e(pe,{})})})]}),e(r,{path:"compare",handle:{crumb:()=>"compare"},loader:me,element:e(ue,{})})]})]}),n(r,{path:"/playground",handle:{crumb:()=>"Playground"},children:[e(r,{index:!0,element:e(b,{})}),e(r,{path:"datasets/:datasetId",element:e(b,{}),children:e(r,{path:"examples/:exampleId",element:e(he,{})})}),e(r,{path:"spans/:spanId",element:e(ge,{}),loader:fe,handle:{crumb:a=>a.span.__typename==="Span"?`span ${a.span.context.spanId}`:"span unknown"}})]}),e(r,{path:"/apis",element:e(be,{}),handle:{crumb:()=>"APIs"}}),e(r,{path:"/settings",element:e(xe,{}),handle:{crumb:()=>"Settings"}})]})})]})),{basename:window.Config.basename});function _e(){return e(k,{router:Ie})}function je(){return e(ye,{children:e(ve,{children:e(De,{})})})}function De(){const{theme:a}=Fe();return e(z,{theme:a,children:e(A,{theme:T,children:n(C.RelayEnvironmentProvider,{environment:we,children:[e(Ce,{}),e(ke,{children:e(Ee,{children:e(Pe,{children:e(c.Suspense,{children:e(Le,{children:e(_e,{})})})})})})]})})})}const Oe=document.getElementById("root"),Te=I.createRoot(Oe);Te.render(e(je,{}));
