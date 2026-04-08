import { useState } from 'react';
import ProblemRow from './ProblemRow';
import { countVisible } from '../utils/filter';

export default function SubIdea({ sub, bi, si, patKey, problems, filters, isDone, getNote, hasTag, setDone, setNote, toggleTag, googSet, onOpenTemplate, isOpen }) {
  const [showVar, setShowVar] = useState(false);
  const [showSim, setShowSim] = useState(false);

  const repNums   = sub.rep || [];
  const varNums   = filters.repOnly ? [] : (sub.var || []);
  const simNums   = filters.repOnly ? [] : (sub.similar || []);

  const rc = countVisible(repNums, problems, filters, isDone, hasTag, googSet);
  const vc = countVisible(varNums, problems, filters, isDone, hasTag, googSet);
  const pc = countVisible(simNums, problems, filters, isDone, hasTag, googSet);

  if (rc + vc + pc === 0) return null;

  const open = isOpen || !!filters.search;

  const rowProps = { problems, isDone, getNote, hasTag, setDone, setNote, toggleTag, googSet };

  return (
    <div id={`sub-${bi}-${si}`} className="sub">
      <div className="sh">
        <span className="sn">{si + 1}</span>
        <span className="si">{sub.idea}</span>
        {sub.template && (
          <button className="tpl-btn" onClick={() => onOpenTemplate(sub)} title="View code template">{'{ }'}</button>
        )}
      </div>
      {sub.insight && <div className="sd">{sub.insight}</div>}

      {rc > 0 && (
        <div className="ts">
          <span className="tl rep">Rep</span>
          {repNums.map(n => <ProblemRow key={n} n={n} role="rep" {...rowProps} />)}
        </div>
      )}

      {vc > 0 && (
        <div className="ts">
          <span className="tog" onClick={() => setShowVar(v => !v)}>
            {showVar || open ? `- hide variations` : `+ ${vc} variations`}
          </span>
          <div className={showVar || open ? '' : 'hid'}>
            <span className="tl va">Variation</span>
            {varNums.map(n => <ProblemRow key={n} n={n} role="var" {...rowProps} />)}
          </div>
        </div>
      )}

      {pc > 0 && (
        <div className="ts">
          <span className="tog" onClick={() => setShowSim(v => !v)}>
            {showSim || open ? `- hide similar` : `+ ${pc} similar`}
          </span>
          <div className={showSim || open ? '' : 'hid'}>
            <span className="tl pa">Similar</span>
            {simNums.map(n => <ProblemRow key={n} n={n} role="similar" {...rowProps} />)}
          </div>
        </div>
      )}
    </div>
  );
}
