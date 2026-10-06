type ApprovalCardProps = {
  file: string;
  onAllowOnce?: () => void;
  onAllowAlways?: () => void;
  onDeny?: () => void;
  onRerun?: () => void;
};

export function ApprovalCard({ file, onAllowOnce, onAllowAlways, onDeny, onRerun }: ApprovalCardProps) {
  return (
    <div className="cc-approval">
      <span>
        改写 <span className="cc-approval-file">{file}</span>
      </span>
      <span className="cc-spacer" />
      <button className="cc-btn cc-btn-primary cc-btn-sm" onClick={onAllowOnce}>放行一次</button>
      <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onAllowAlways}>始终</button>
      <button className="cc-btn cc-btn-sm" onClick={onDeny}>驳回</button>
      <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onRerun}>从此重跑</button>
    </div>
  );
}
