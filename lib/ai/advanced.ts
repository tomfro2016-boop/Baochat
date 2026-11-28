import { webSearch, readPage } from '@/lib/search';

import { DEEP_IDS, type DeepId } from './deep-meta';
export { DEEP_IDS, type DeepId };

const TEXT: Record<DeepId, string> = {
  swarm:
    'CHẾ ĐỘ NHÓM CHUYÊN GIA: bên dưới là báo cáo của nhiều chuyên gia đã làm việc song song cho mục tiêu của người dùng. Hãy tổng hợp thành MỘT kế hoạch thống nhất: tóm tắt mục tiêu; kết luận chính của từng chuyên gia (ngắn gọn); chỗ các chuyên gia mâu thuẫn hoặc thiếu dữ liệu và cách xử lý; kế hoạch hành động theo giai đoạn (việc, người/nguồn lực, thời hạn gợi ý); rủi ro chính; 3 việc nên làm ngay trong tuần này. Không bịa số liệu: con số nào là ước tính phải ghi rõ "ước tính".',
  premortem:
    'CHẾ ĐỘ RÀ SOÁT TRƯỚC KHI GỬI: người dùng dán email, hợp đồng, bài đăng hoặc mã nguồn sắp xuất bản. Hãy đóng vai người gác cổng khắt khe nhưng công bằng. Trả về: (1) "Rủi ro nghiêm trọng" (lỗ hổng bảo mật, điều khoản bất lợi, thông tin nhạy cảm bị lộ, sai sự thật), (2) "Dễ gây hiểu lầm" kèm trích đúng cụm từ và người đọc nào có thể hiểu sai, (3) "Nên sửa" kèm câu/đoạn thay thế cụ thể, (4) "Ổn" ngắn gọn. Chỉ nêu điều thực sự thấy trong nội dung; không bịa lỗi để cho đủ mục. Với hợp đồng/pháp lý, nhắc đây không thay thế luật sư.',
  simulate:
    'CHẾ ĐỘ MÔ PHỎNG PHẢN ỨNG: người dùng muốn thử trước một chiến dịch, thông điệp, chính sách hoặc kịch bản đàm phán. Hãy dựng 6-8 nhóm người ảo đa dạng (đặc điểm, nhu cầu, nỗi lo, mức sẵn sàng), mỗi nhóm phản ứng bằng 1-2 câu trong vai và nêu hành vi có thể xảy ra; tổng hợp thành bảng: nhóm, phản ứng, khả năng hưởng ứng (cao/vừa/thấp), lý do. Cuối cùng nêu rủi ro phản ứng ngược và 3 cách điều chỉnh. BẮT BUỘC nói rõ đây là mô phỏng dựa trên giả định, không phải dự báo hay số liệu thị trường thật; không đưa phần trăm cụ thể như thể đã đo đạc.',
  reasoning:
    'CHẾ ĐỘ SUY LUẬN SÂU: trước khi kết luận hãy phân tích bài toán từng bước, xét ít nhất một cách tiếp cận khác để đối chiếu, tự kiểm tra lại các phép tính và lập luận, rồi mới trình bày. Cấu trúc: "Hướng giải" ngắn gọn, các bước chính, "Kiểm tra lại", rồi "Kết luận". Nếu phát hiện lỗi ở bước trước, sửa công khai. Với yêu cầu về phần mềm, nêu kiến trúc, đánh đổi và các trường hợp biên trước khi viết mã.',
  verify:
    'CHẾ ĐỘ TỰ KIỂM CHỨNG: chỉ khẳng định điều có trong nguồn đã cung cấp hoặc là kiến thức phổ biến, ổn định. Mỗi số liệu/trích dẫn phải kèm [n] của nguồn. Gắn nhãn cuối mỗi ý quan trọng: ✅ có nguồn đối chiếu, ⚠️ chỉ một nguồn hoặc suy luận, ❌ không kiểm chứng được. KHÔNG đoán: câu nào chưa chắc thì ghi rõ "chưa kiểm chứng được" thay vì viết như chắc chắn. Kết thúc bằng mục "Cần kiểm tra thêm" nếu còn điểm mơ hồ. Không hứa hẹn độ chính xác tuyệt đối; với y tế, pháp lý, tài chính nhắc người dùng hỏi chuyên gia.',
  council:
    'CHẾ ĐỘ HỘI ĐỒNG CHUYÊN GIA: trước một quyết định, hãy mô phỏng 4 vai có lập trường khác nhau và tranh luận thật sự (không đồng thuận giả): (1) Người ủng hộ mạnh nhất, (2) Người phản biện gay gắt, (3) Chuyên gia quản trị rủi ro, (4) Người thực thi thực tế. Mỗi vai nêu 2-4 luận điểm cụ thể, rồi các vai đáp lại nhau. Sau đó có mục "Điểm mù có thể bỏ sót", "Câu hỏi cần làm rõ", và "Khuyến nghị cân nhắc" kèm điều kiện nên đổi ý. Đây là mô phỏng góc nhìn, không phải lời khuyên chuyên môn; quyết định cuối cùng thuộc về người dùng.',
  research:
    'CHẾ ĐỘ NGHIÊN CỨU CHUYÊN SÂU: viết một BÁO CÁO hoàn chỉnh từ các nguồn đã thu thập. Cấu trúc: tiêu đề, "Tóm tắt điều hành" (3-5 gạch đầu dòng), các mục chính có tiêu đề, bảng số liệu nếu có (chỉ số thật từ nguồn), "Điểm còn tranh cãi hoặc thiếu dữ liệu", "Kết luận". Mọi dữ kiện phải kèm trích dẫn [n] đúng với đánh số nguồn; không bịa số liệu hay nguồn. Khi nguồn mâu thuẫn, nêu cả hai. Cuối báo cáo liệt kê danh sách nguồn đã dùng theo số [n].',
};

export function deepText(id?: string | null): string {
  return id && id in TEXT ? TEXT[id as DeepId] : '';
}

export const PLAN_PROMPT =
  'Bạn lập kế hoạch tìm kiếm. Từ yêu cầu của người dùng, đưa ra 3 đến 4 truy vấn tìm kiếm web NGẮN, khác nhau về góc độ (khái niệm, số liệu mới nhất, so sánh, quan điểm trái chiều). Chỉ trả về MỘT mảng JSON các chuỗi, không giải thích. Ví dụ: ["truy vấn 1","truy vấn 2"]';

export function parsePlan(text: string, fallback: string): string[] {
  try {
    const m = /\[[\s\S]*\]/.exec(text);
    const arr = m ? JSON.parse(m[0]) : [];
    const qs = (Array.isArray(arr) ? arr : []).filter((x) => typeof x === 'string' && x.trim()).map((x: string) => x.trim().slice(0, 200)).slice(0, 4);
    if (qs.length) return qs;
  } catch {
    /* dùng truy vấn gốc */
  }
  return [fallback.slice(0, 200)];
}

export type Src = { title: string; url: string; snippet: string };

/** Chạy nhiều truy vấn, gộp nguồn không trùng, đọc nội dung các trang đầu, đánh số [n] thống nhất. */
export async function gatherSources(queries: string[], onStep?: (msg: string) => void) {
  const seen = new Map<string, Src>();
  let done = 0;
  await Promise.all(
    queries.map(async (qy) => {
      try {
        const r = await webSearch(qy, 6);
        for (const x of r) if (!seen.has(x.url)) seen.set(x.url, { title: x.title, url: x.url, snippet: x.snippet });
      } catch {
        /* bỏ qua truy vấn lỗi */
      }
      done++;
      onStep?.(`Đã tìm ${done}/${queries.length} truy vấn…`);
    }),
  );
  const sources = [...seen.values()].slice(0, 12);
  onStep?.(`Đang đọc ${Math.min(sources.length, 8)} nguồn…`);
  const pages = await Promise.all(sources.slice(0, 8).map((s) => readPage(s.url, 3500).catch(() => '')));
  const context = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nTóm tắt: ${s.snippet}${pages[i] ? `\nNội dung (cắt ngắn): ${pages[i]}` : ''}`)
    .join('\n\n---\n\n')
    .slice(0, 32_000);
  return { sources, context };
}

export const SWARM_PLAN_PROMPT =
  'Bạn là người điều phối. Từ mục tiêu lớn của người dùng, chia thành 4 đến 5 chuyên gia với phạm vi KHÁC NHAU, bao phủ các mặt quan trọng nhất của mục tiêu. Chỉ trả về MỘT mảng JSON, mỗi phần tử {"role":"tên chuyên gia ngắn","task":"nhiệm vụ cụ thể 1-2 câu"}. Không giải thích.';

export function parseSwarm(text: string): { role: string; task: string }[] {
  try {
    const m = /\[[\s\S]*\]/.exec(text);
    const arr = m ? JSON.parse(m[0]) : [];
    return (Array.isArray(arr) ? arr : [])
      .filter((x) => x && typeof x.role === 'string' && typeof x.task === 'string')
      .map((x) => ({ role: x.role.trim().slice(0, 60), task: x.task.trim().slice(0, 300) }))
      .filter((x) => x.role && x.task)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export const swarmAgentPrompt = (role: string, task: string) =>
  `Bạn là ${role} trong một nhóm chuyên gia. Nhiệm vụ riêng của bạn: ${task}\nTrả lời tối đa 250 từ, cụ thể và thực tế, nêu rõ giả định; con số chỉ là ước tính nếu không có dữ liệu, không bịa nguồn. Chỉ viết phần việc của bạn.`;
