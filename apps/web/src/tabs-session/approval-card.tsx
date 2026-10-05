type ApprovalCardProps = {
  file: string;
  onAllowOnce?: () => void;
  onAllowAlways?: () => void;
  onDeny?: () => void;
  onRerun?: () => void;
};

export function ApprovalCard({ file, onAllowOnce, onAllowAlways, onDeny, onRerun }: ApprovalCardProps) {
  return (
    <div>
      改写 {file}
      <button onClick={onAllowOnce}>放行一次</button>
      <button onClick={onAllowAlways}>始终</button>
      <button onClick={onDeny}>驳回</button>
      <button onClick={onRerun}>从此重跑</button>
    </div>
  );
}
