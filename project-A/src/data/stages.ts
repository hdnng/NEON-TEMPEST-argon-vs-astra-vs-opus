import { StageId } from '../core/types';

export interface StageDef {
  id: StageId;
  name: string;
  subtitle: string;
  location: string;
  skyTop: string;
  skyBottom: string;
  floorColor: string;
  floorGridColor: string;
  neonPrimary: string;
  neonSecondary: string;
  neonAccent: string;
  fogColor: string;
  rainIntensity: number; // 0 to 1
  hasCrowd: boolean;
  bpm: number;
  signs: string[];
}

export const STAGES: Record<StageId, StageDef> = {
  rooftop: {
    id: 'rooftop',
    name: 'SHIN-GION SKY DOJO',
    subtitle: 'SECTOR 7 // PENTHOUSE HELIPAD',
    location: 'ALTITUDE 480M — HEAVY ACID RAIN',
    skyTop: '#030614',
    skyBottom: '#0d1b3a',
    floorColor: '#070d1e',
    floorGridColor: '#00f0ff',
    neonPrimary: '#00f0ff',
    neonSecondary: '#ff007f',
    neonAccent: '#ffbe00',
    fogColor: 'rgba(0, 210, 255, 0.14)',
    rainIntensity: 1.0,
    hasCrowd: true,
    bpm: 136,
    signs: ['NEO-KYOTO', 'TEMPEST // 2099', 'ZAIBATSU CORP', 'CYBER DOJO']
  },
  alley: {
    id: 'alley',
    name: 'KURO-MACHI UNDERGROUND',
    subtitle: 'SUB-LEVEL 04 // BLACKNET ARENA',
    location: 'ILLEGAL CIRCUIT — HIGH VOLTAGE',
    skyTop: '#090314',
    skyBottom: '#220934',
    floorColor: '#0c0618',
    floorGridColor: '#ff00aa',
    neonPrimary: '#ff00aa',
    neonSecondary: '#00ffcc',
    neonAccent: '#ff5500',
    fogColor: 'rgba(255, 0, 170, 0.15)',
    rainIntensity: 0.65,
    hasCrowd: true,
    bpm: 142,
    signs: ['BLACKNET', 'FIGHT CLUB', 'NO MERCY', 'SYNTH RAMEN']
  },
  shrine: {
    id: 'shrine',
    name: 'AMATERASU CYBER-SHRINE',
    subtitle: 'PRECINCT 01 // QUANTUM SANCTUARY',
    location: 'CORE REACTOR — MAGNETIC STORM',
    skyTop: '#040c14',
    skyBottom: '#0a2936',
    floorColor: '#06131c',
    floorGridColor: '#00ffaa',
    neonPrimary: '#00ffaa',
    neonSecondary: '#ff2255',
    neonAccent: '#38b6ff',
    fogColor: 'rgba(0, 255, 170, 0.14)',
    rainIntensity: 0.45,
    hasCrowd: false,
    bpm: 148,
    signs: ['AMATERASU', 'PROTOCOL 00', 'SANCTUARY', 'AEGIS CORE']
  }
};

export const STAGE_LIST: StageDef[] = [STAGES.rooftop, STAGES.alley, STAGES.shrine];
