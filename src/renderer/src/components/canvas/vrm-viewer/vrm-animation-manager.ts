import * as THREE from 'three';
import { VRM, VRMHumanBoneName, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { VrmAnimationState } from './types';

export class VrmAnimationManager {
  private vrm: VRM;
  state: VrmAnimationState = 'idle';

  private stateTimer = 0;
  private isTransitioning = false;
  private transitionTimer = 0;
  private movementLocked = false;
  private movementLockTimer = 0;

  private headTgt = { x: 0, y: 0, z: 0 };
  private headCur = { x: 0, y: 0, z: 0 };
  private headVelocity = { x: 0, y: 0, z: 0 };
  private headTimer = 0;
  private eyeTimer = 0;
  private eyeLeadTimer = 0;
  private _pendingHeadTarget: { x: number; y: number; z: number } | null = null;

  eyeLookAtTarget: THREE.Object3D;
  private eyeTgtPos = new THREE.Vector3(0, 0, 5);

  private bodyTimer = 0;
  private bodyTgt = { x: 0 };
  private bodyCur = { x: 0 };

  private armTimer = 0;

  private blinkTimer = 0;
  private nextBlink = 1.5;
  private blinkVal = 0;

  private idleLookingAtUser = false;
  private idleLookAtUserTimer = 0;
  private listeningSideLook = false;
  private listeningSideLookTimer = 0;
  private listeningSideDirection = 1;
  private talkingNodPhase = 0;
  private talkingCurrentNodFreq = 2.0;
  private talkingCurrentNodIntensity = 0.2;
  private talkingNextNodChange = 0;
  private thinkingLookingAtUser = false;
  private thinkingLookAtUserTimer = 0;

  isMixamoPlaying = false;
  isDancing = false;
  isSleeping = false;
  isSpeaking = false;
  isSpecialAction = false;

  private proceduralDisabled = false;

  private readonly cfg = {
    headNod: 0.2,
    headTurn: 0.13,
    blinkMin: 0.5, blinkMax: 3.0, blinkSpeed: 8.0,
    transitionLockDuration: 0.5,
    transitionEaseSpeed: 0.08,
    headAcceleration: 0.001,
    headDamping: 0.85,
    stateAcceleration: { idle: 1.0, listening: 8.0, thinking: 2.0, talking: 10.0 } as Record<string, number>,
    stateConfig: {
      idle: {
        lookDuration: 3.0, lookChangeChance: 0.3,
        headRangeX: 0.25, headRangeY: 0.75, headRangeZ: 0.18,
        eyeRange: 7.0,
        lookAtUserChance: 0.35, lookAtUserDurationMin: 1.5, lookAtUserDurationMax: 3.5,
        lookAtUserEyeReset: true,
      },
      listening: {
        nodIntensity: 0.35, nodCount: 2,
        eyeRange: 5.0,
        sideLookChance: 0.15, sideLookDurationMin: 1.0, sideLookDurationMax: 3.0,
        sideLookHeadTurn: 0.15, sideLookEyeRange: 4.0,
        focusOnUser: true,
      },
      thinking: {
        lookDuration: 1.5, lookChangeChance: 0.35,
        headRangeX: 0.12, headRangeY: 0.25, headRangeZ: 0.12,
        eyeRange: 6.0, lookUpBias: 0.6,
        eyeLeadTime: 0.1, eyeLeadAmount: 1.1, eyeHeadSync: 0.8,
        lookAtUserChance: 0.3, lookAtUserDurationMin: 1.0, lookAtUserDurationMax: 2.0,
      },
      talking: {
        nodIntensity: 0.5, nodFrequency: 1.8, nodVariation: 0.6,
        occasionalTurn: 0.2, eyeRange: 6.0,
        nodIntensityVariation: 0.4, nodFrequencyVariation: 0.5, nodChangeInterval: 1.5,
        tiltChance: 0.25, tiltIntensity: 0.08,
      },
    },
  };

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.eyeLookAtTarget = new THREE.Object3D();
    this.eyeLookAtTarget.position.set(0, 0, 5);
    vrm.scene.add(this.eyeLookAtTarget);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.eyeLookAtTarget;
      vrm.lookAt.enabled = true;
    }
    this.nextBlink = this.rand(this.cfg.blinkMin, this.cfg.blinkMax);
  }

  setState(newState: VrmAnimationState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateTimer = 0;
    this.isTransitioning = true;
    this.transitionTimer = 0;
    this.headTgt = { x: 0, y: 0, z: 0 };
    this.eyeTgtPos.set(0, 0, 5);
    this.headTimer = 0; this.eyeTimer = 0; this.eyeLeadTimer = 0;
    this.idleLookingAtUser = false; this.idleLookAtUserTimer = 0;
    this.listeningSideLook = false; this.listeningSideLookTimer = 0;
    this.talkingNextNodChange = 0;
    this.thinkingLookingAtUser = false; this.thinkingLookAtUserTimer = 0;
    this._pendingHeadTarget = null;
    this.movementLocked = false; this.movementLockTimer = 0;
  }

  private rand(min: number, max: number) { return min + Math.random() * (max - min); }

  private smoothEase(cur: number, tgt: number, vel: number, acc: number, damp: number, dt: number) {
    const nv = (vel + (tgt - cur) * acc) * damp;
    return { value: cur + nv * dt * 60, velocity: nv };
  }

  private updateHeadWithPhysics(dt: number) {
    const acc = this.cfg.headAcceleration * (this.cfg.stateAcceleration[this.state] ?? 1);
    const d = this.cfg.headDamping;
    const xr = this.smoothEase(this.headCur.x, this.headTgt.x, this.headVelocity.x, acc, d, dt);
    const yr = this.smoothEase(this.headCur.y, this.headTgt.y, this.headVelocity.y, acc, d, dt);
    const zr = this.smoothEase(this.headCur.z, this.headTgt.z, this.headVelocity.z, acc, d, dt);
    this.headCur.x = xr.value; this.headVelocity.x = xr.velocity;
    this.headCur.y = yr.value; this.headVelocity.y = yr.velocity;
    this.headCur.z = zr.value; this.headVelocity.z = zr.velocity;
  }

  private centerHead(ease = 0.04): boolean {
    this.headCur.x += (0 - this.headCur.x) * ease;
    this.headCur.y += (0 - this.headCur.y) * ease;
    this.headCur.z += (0 - this.headCur.z) * ease;
    this.headVelocity.x *= 0.9; this.headVelocity.y *= 0.9; this.headVelocity.z *= 0.9;
    this.eyeTgtPos.set(0, 0, 5);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, ease * 1.5);
    const t = 0.02;
    return Math.abs(this.headCur.x) < t && Math.abs(this.headCur.y) < t && Math.abs(this.headCur.z) < t;
  }

  private updateIdleState(dt: number, cfg: typeof this.cfg.stateConfig.idle) {
    this.headTimer += dt; this.eyeTimer += dt;
    if (this.idleLookingAtUser) {
      this.idleLookAtUserTimer -= dt;
      if (this.idleLookAtUserTimer <= 0) { this.idleLookingAtUser = false; this.headTimer = 0; }
    } else if (this.headTimer > cfg.lookDuration) {
      if (Math.random() < cfg.lookAtUserChance) {
        this.idleLookingAtUser = true;
        this.idleLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
        this.headTgt = { x: 0, y: 0, z: 0 };
        if (cfg.lookAtUserEyeReset) this.eyeTgtPos.set(0, 0, 5);
        this.headTimer = 0;
      } else if (Math.random() < cfg.lookChangeChance) {
        const angle = Math.random() * Math.PI * 2;
        const rm = 0.6 + Math.random() * 0.4;
        this.headTgt.x = Math.sin(angle) * cfg.headRangeX * rm;
        this.headTgt.y = Math.cos(angle) * cfg.headRangeY * rm;
        this.headTgt.z = this.rand(-cfg.headRangeZ, cfg.headRangeZ) * rm;
        this.eyeTgtPos.x = Math.sin(angle) * cfg.eyeRange;
        this.eyeTgtPos.y = Math.cos(angle) * cfg.eyeRange * 0.4;
        this.eyeTgtPos.z = 5 + Math.cos(angle) * 1.5;
        this.headTimer = 0;
      }
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.025);
  }

  private updateListeningState(dt: number, cfg: typeof this.cfg.stateConfig.listening) {
    this.headTimer += dt; this.eyeTimer += dt;
    if (this.listeningSideLook) {
      this.listeningSideLookTimer -= dt;
      if (this.listeningSideLookTimer <= 0) {
        this.listeningSideLook = false;
        this.headTgt.y = 0;
        this.eyeTgtPos.set(0, 0, 5);
      }
    } else if (Math.random() < cfg.sideLookChance * dt) {
      this.listeningSideLook = true;
      this.listeningSideLookTimer = this.rand(cfg.sideLookDurationMin, cfg.sideLookDurationMax);
      this.listeningSideDirection = Math.random() < 0.5 ? -1 : 1;
      this.headTgt.y = cfg.sideLookHeadTurn * this.listeningSideDirection;
      this.eyeTgtPos.x = cfg.sideLookEyeRange * this.listeningSideDirection;
      this.eyeTgtPos.y = 0; this.eyeTgtPos.z = 5;
    }
    const nodCycle = 2.5;
    const cyclePhase = (this.stateTimer % nodCycle) / nodCycle;
    if (!this.listeningSideLook) {
      if (cyclePhase < 0.4) {
        const nodPhase = (cyclePhase / 0.4) * Math.PI * 2 * cfg.nodCount;
        this.headTgt.x = Math.sin(nodPhase) * this.cfg.headNod * cfg.nodIntensity;
      } else {
        this.headTgt.x *= 0.9;
      }
      if (cfg.focusOnUser && this.eyeTimer > 2.0) {
        this.eyeTgtPos.x = this.rand(-1, 1); this.eyeTgtPos.y = this.rand(-0.5, 0.5); this.eyeTgtPos.z = 5;
        this.eyeTimer = 0;
      }
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.03);
  }

  private updateThinkingState(dt: number, cfg: typeof this.cfg.stateConfig.thinking) {
    this.headTimer += dt; this.eyeTimer += dt; this.eyeLeadTimer += dt;
    if (this.thinkingLookingAtUser) {
      this.thinkingLookAtUserTimer -= dt;
      if (this.thinkingLookAtUserTimer <= 0) { this.thinkingLookingAtUser = false; this.headTimer = 0; }
    } else if (this.headTimer > cfg.lookDuration) {
      if (Math.random() < cfg.lookAtUserChance) {
        this.thinkingLookingAtUser = true;
        this.thinkingLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
        this.eyeTgtPos.set(0, 0, 5);
        this._pendingHeadTarget = { x: 0, y: 0, z: 0 };
        this.eyeLeadTimer = 0; this.headTimer = 0;
      } else if (Math.random() < cfg.lookChangeChance) {
        const angle = (Math.random() * Math.PI * 1.6) - (Math.PI * 0.3);
        const upBias = cfg.lookUpBias * 0.25;
        const eyeSync = Math.random() < cfg.eyeHeadSync;
        if (eyeSync) {
          this.eyeTgtPos.x = Math.sin(angle) * cfg.eyeRange * cfg.eyeLeadAmount;
          this.eyeTgtPos.y = (cfg.eyeRange * 0.6 + upBias * 10) * cfg.eyeLeadAmount;
          this.eyeTgtPos.z = 4;
        } else {
          const da = Math.random() * Math.PI * 2;
          this.eyeTgtPos.x = Math.sin(da) * cfg.eyeRange * 0.6;
          this.eyeTgtPos.y = cfg.eyeRange * 0.4; this.eyeTgtPos.z = 5;
        }
        this._pendingHeadTarget = {
          x: Math.sin(angle) * cfg.headRangeX + upBias,
          y: Math.cos(angle) * cfg.headRangeY,
          z: this.rand(-cfg.headRangeZ, cfg.headRangeZ),
        };
        this.eyeLeadTimer = 0; this.headTimer = 0;
      }
    }
    if (this._pendingHeadTarget && this.eyeLeadTimer >= cfg.eyeLeadTime) {
      this.headTgt.x = this._pendingHeadTarget.x;
      this.headTgt.y = this._pendingHeadTarget.y;
      this.headTgt.z = this._pendingHeadTarget.z;
      this._pendingHeadTarget = null;
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.04);
  }

  private updateTalkingState(dt: number, cfg: typeof this.cfg.stateConfig.talking) {
    this.headTimer += dt; this.eyeTimer += dt; this.talkingNodPhase += dt;
    if (this.stateTimer > this.talkingNextNodChange) {
      this.talkingCurrentNodFreq = cfg.nodFrequency * (1 + (Math.random() * 2 - 1) * cfg.nodFrequencyVariation);
      this.talkingCurrentNodIntensity = cfg.nodIntensity * (1 + (Math.random() * 2 - 1) * cfg.nodIntensityVariation);
      this.talkingNextNodChange = this.stateTimer + cfg.nodChangeInterval * (0.7 + Math.random() * 0.6);
    }
    if (Math.random() > 0.15) {
      const nodPhase = (this.talkingNodPhase * this.talkingCurrentNodFreq * Math.PI * 2) % (Math.PI * 2);
      this.headTgt.x = Math.sin(nodPhase) * (0.7 + Math.random() * 0.3) * this.talkingCurrentNodIntensity * cfg.nodVariation * this.cfg.headNod;
    } else {
      this.headTgt.x *= 0.9;
    }
    if (Math.random() < cfg.tiltChance * dt) {
      this.headTgt.z = cfg.tiltIntensity * (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4);
    }
    if (Math.random() < cfg.occasionalTurn * dt * 0.5) {
      this.headTgt.y = this.rand(-this.cfg.headTurn * 0.15, this.cfg.headTurn * 0.15);
    }
    this.headTgt.y *= 0.95; this.headTgt.z *= 0.94;
    if (this.eyeTimer > 2.5) {
      const s = Math.random() * 0.4 - 0.2;
      this.eyeTgtPos.x = Math.sin(s) * cfg.eyeRange * 0.3;
      this.eyeTgtPos.y = this.rand(-1, 1); this.eyeTgtPos.z = 5;
      this.eyeTimer = 0;
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.025);
  }

  setProceduralDisabled(disabled: boolean) {
    this.proceduralDisabled = disabled;
  }

  update(dt: number) {
    if (!this.vrm) return;

    if (this.vrm.expressionManager) {
      this.blinkTimer += dt;
      if (this.blinkTimer > this.nextBlink) {
        this.blinkTimer = 0;
        this.nextBlink = this.rand(this.cfg.blinkMin, this.cfg.blinkMax);
      }
      this.blinkVal += (this.blinkTimer < 0.1 ? dt : -dt) * this.cfg.blinkSpeed;
      this.blinkVal = Math.max(0, Math.min(1, this.blinkVal));
      
      this.vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, this.blinkVal);
      this.vrm.expressionManager.setValue('blink', this.blinkVal);
    }

    if (this.isTransitioning) {
      this.transitionTimer += dt;
      const centered = this.centerHead(this.cfg.transitionEaseSpeed);
      if (centered && this.transitionTimer >= 0.4) {
        this.isTransitioning = false;
        this.movementLocked = true;
        this.movementLockTimer = 0;
        this.headVelocity = { x: 0, y: 0, z: 0 };
      }
    } else if (this.movementLocked) {
      this.movementLockTimer += dt;
      this.headTgt = { x: 0, y: 0, z: 0 };
      this.updateHeadWithPhysics(dt);
      this.eyeTgtPos.set(0, 0, 5);
      this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.05);
      if (this.movementLockTimer >= this.cfg.transitionLockDuration) this.movementLocked = false;
    } else {
      const sc = this.cfg.stateConfig as Record<string, any>;
      const stateCfg = sc[this.state];
      if (this.state === 'idle') this.updateIdleState(dt, stateCfg);
      else if (this.state === 'listening') this.updateListeningState(dt, stateCfg);
      else if (this.state === 'thinking') this.updateThinkingState(dt, stateCfg);
      else if (this.state === 'talking') this.updateTalkingState(dt, stateCfg);
    }
    this.stateTimer += dt;

    if (!this.isDancing && !this.isSleeping && !this.proceduralDisabled) {
      const neck = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Neck);
      if (neck) {
        if (!this.isMixamoPlaying) neck.quaternion.identity();
        const qNeck = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.headCur.x * 0.4, this.headCur.y * 0.5, this.headCur.z * 0.5, 'XYZ'));
        neck.quaternion.multiply(qNeck);
      }
      const head = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head);
      if (head) {
        if (!this.isMixamoPlaying) head.quaternion.identity();
        const qHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.headCur.x * 0.6, this.headCur.y * 0.5, this.headCur.z * 0.5, 'XYZ'));
        head.quaternion.multiply(qHead);
      }
    }

    if (this.isDancing || this.isSpecialAction || this.isSleeping || this.proceduralDisabled) return;

    this.bodyTimer += dt;
    if (this.bodyTimer > 2.8) { this.bodyTgt.x = this.rand(-0.05, 0.05); this.bodyTimer = 0; }
    this.bodyCur.x += (this.bodyTgt.x - this.bodyCur.x) * 0.01;
    const spine = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    if (spine) {
      if (!this.isMixamoPlaying) spine.quaternion.identity();
      const qSpine = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.bodyCur.x, 0, 0, 'XYZ'));
      spine.quaternion.multiply(qSpine);
    }

    this.armTimer += dt;
    const sway = Math.sin(this.armTimer * 0.5);
    const swayFast = Math.sin(this.armTimer * 1.2);

    const la = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
    const ra = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
    const lfa = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
    const rfa = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
    const lh = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftHand);
    const rh = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightHand);

    if (!this.isMixamoPlaying) {
      if (la) la.rotation.z = -1.2;
      if (ra) ra.rotation.z = 1.2;
    }

    if (la) {
      la.rotation.z += (swayFast * 0.04);
      la.rotation.x += sway * 0.08;
    }
    if (ra) {
      ra.rotation.z -= (swayFast * 0.04);
      ra.rotation.x += sway * 0.08;
    }

    if (lfa) lfa.rotation.y += sway * 0.15;
    if (rfa) rfa.rotation.y -= sway * 0.15;

    if (lh) {
      lh.rotation.x += swayFast * 0.08;
      lh.rotation.z += sway * 0.08;
    }
    if (rh) {
      rh.rotation.x += swayFast * 0.08;
      rh.rotation.z -= sway * 0.08;
    }
  }

  destroy() {
    if (this.vrm.scene.children.includes(this.eyeLookAtTarget)) {
      this.vrm.scene.remove(this.eyeLookAtTarget);
    }
    if (this.vrm.lookAt) this.vrm.lookAt.target = undefined as any;
  }
}
