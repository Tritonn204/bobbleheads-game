export class Vec2 {
    constructor(x,y) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
    }

    lerp(vec, amt) {
        this.x = (1-amt)*this.x+(amt*vec.x);
        this.y = (1-amt)*this.y+(amt*vec.y);
    }

    moveTowards(vec, amt) {
        const velocity = Math.min(amt, getDistance(this,vec));
        const angle = angleFromPoints(this.x,this.y,vec.x,vec.y);
        this.x += velocity*Math.cos(angle);
        this.y += velocity*Math.sin(angle);
    }
}

export const getDistance = (A, B) =>{
    const a = A.x - B.x;
    const b = A.y - B.y;

    return Math.hypot(a,b);
}

export function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

export const calcSpeed = (vx, vy) => {
    return Math.sqrt(Math.pow(vx, 2) + Math.pow(vy, 2));
}

export const angleFromPoints = (cx, cy, ex, ey) => {
  var dy = ey - cy;
  var dx = ex - cx;
  var theta = Math.atan2(dy, dx); // range (-PI, PI]
  //if (theta < 0) theta = 360 + theta; // range [0, 360)
  return theta;
}

export const angleToVel = (theta) => {
    return new Vec2(Math.cos(theta), Math.sin(theta));
}

export const lerp = (start, end, amt) => {
  return ((1-amt)*start+(amt*end));
}

export class Matrix {
    constructor() {
        this.grid = [];
    }

    get(x, y) {
        const col = this.grid[x];
        if (col) {
            return col[y];
        }
        return undefined;
    }

    set(x, y, value) {
        if (!this.grid[x]) {
            this.grid[x] = [];
        }
        this.grid[x][y] = value;
    }
}
