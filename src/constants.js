const CANVAS_PAD_RL   = { l:52, r:16, t:20, b:36 };
const CANVAS_PAD_BODE = { l:56, r:16, t:30, b:34 };

const COLORS = {
  bg:       '#0d1117',
  pole:     '#f85149',
  zero:     '#3fb950',
  asym:     'rgba(210,153,34,0.35)',
  asymBode: 'rgba(255,200,50,.45)',
  ref:      'rgba(255,255,255,.12)',
  grid:     '#1c2128',
  axis:     '#30363d',
  label:    '#484f58',
  
  branches: ['#58a6ff','#3fb950','#ff7b72','#ffa657','#d2a8ff','#79c0ff','#56d364','#e3b341'],
};

const RL_CONFIG = {
  steps:          350,    
  kPowerLaw:      1.6,    
  breakawayMin:  -50,     
  breakawayMax:   10,     
  breakawayStep:  0.02,   
  breakawayMinDist: 0.2,  
  critKIterations: 40,    
  critKThreshold: 0.01,   
  
  arcMaxJump:     0.18,   
  arcMaxDepth:    7,      
  arcMinDK:       1e-6,   
  
  zeroReachEps:   0.04,   
  kMaxAutoGrow:   8,      
  kMaxAutoSteps:  6,      
};

const JW_CONFIG = {
  scanKMax:     5000,   
  scanSteps:    400,    
  refineIters:  50,     
  imagEps:      1e-3,   
};

const BODE_FACTOR_COLORS = {
  gain:      '#8b949e',  
  integ:     '#58a6ff',  
  realZero:  '#3fb950',  
  realPole:  '#ffa657',  
  cplxZero:  '#56d364',  
  cplxPole:  '#ff7b72',  
  sum:       '#e6edf3',  
};

const SEMILOG_CONFIG = {
  decadeMinor: [2,3,4,5,6,7,8,9],  
  yStepDb:     20,                  
  yStepDeg:    45,                  
};

const ZOOM_CONFIG = {
  inFactor:   0.8,    
  outFactor:  1.25,   
  wheelIn:    0.9,    
  wheelOut:   1.111,
};

const MOBILE_BREAKPOINT = 768;

const BODE_CONFIG = {
  pts:      800,     
  logStart: -2,      
  logEnd:    3,      
};

const ROOT_FIND = {
  maxIter:      300,    
  tolerance:    1e-12,  
  radiusFactor: 1.2,    
  divEps:       1e-280, 
};

const EPS = {
  im:       1e-4,   
  nearZero: 1e-6,   
  kMin:    -0.001,  
  magMin:   1e-15,  
  root:     1e-14,  
};
