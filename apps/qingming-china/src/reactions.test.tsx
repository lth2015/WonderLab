import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ENVIRONMENT } from './content';
import { initialState } from './game';
import { ReactionFx } from './ReactionFx';
import { PaintedLandscape } from './PaintedArt';
import { REACTIONS } from './reactions';

describe('visible world reactions',()=>{
  it('gives every registered hotspot renderable marks at its own world anchor',()=>{
    expect(Object.keys(REACTIONS).sort()).toEqual(ENVIRONMENT.map(env=>env.id).sort());
    for(const env of ENVIRONMENT){
      const output=renderToStaticMarkup(<ReactionFx reaction={{id:env.id,serial:1}}/>);
      expect(output).toContain(`translate(${env.x} ${env.y})`);expect(output).toContain(`reaction-${REACTIONS[env.id]}`);
      expect(output).toContain('reaction-static');expect(output).toMatch(/<path|<ellipse|<circle/);
    }
  });
  it('animates only local groups, so movement never replaces world placement or the art used by gifts',()=>{
    const output=renderToStaticMarkup(<PaintedLandscape state={initialState()} feedback={null} center={1800} viewHalf={900}/>);
    expect((output.match(/data-walker=/g)??[]).length).toBe(14);
    expect((output.match(/class="person-idle"/g)??[]).length).toBe(6);
    expect(output).toMatch(/transform="translate\(135 467\)" class="painted-passer[^\"]*"/);
    expect(output).toMatch(/transform="translate\(2880 850\)" class="story-person[^\"]*"/);
    expect(output).not.toContain('data-reaction-id');
  });
});
